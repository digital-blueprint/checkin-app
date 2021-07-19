import DBPLitElement from '@dbp-toolkit/common/dbp-lit-element';
import {getStackTrace} from "@dbp-toolkit/common/error";
import {send} from "@dbp-toolkit/common/notification";

/**
 * Dummy function to mark strings as i18next keys for i18next-scanner
 *
 * @param {string} key
 * @param {object} [options]
 * @returns {string} The key param as is
 */
function i18nKey(key, options) {
    return key;
}

export default class DBPCheckInLitElement extends DBPLitElement {
    constructor() {
        super();
        this.isSessionRefreshed = false;
        this.auth = {};
    }

    static get properties() {
        return {
            ...super.properties,
            auth: { type: Object },
        };
    }

    connectedCallback() {
        super.connectedCallback();

        this._loginStatus = '';
        this._loginState = [];
    }

    /**
     *  Request a re-render every time isLoggedIn()/isLoading() changes
     */
    _updateAuth() {
        this._loginStatus = this.auth['login-status'];

        let newLoginState = [this.isLoggedIn(), this.isLoading()];
        if (this._loginState.toString() !== newLoginState.toString()) {
            this.requestUpdate();
        }
        this._loginState = newLoginState;
    }

    update(changedProperties) {
        changedProperties.forEach((oldValue, propName) => {
            switch (propName) {
                case "auth":
                    this._updateAuth();
                    break;
            }
        });

        super.update(changedProperties);
    }

    /**
     * Returns if a person is set in or not
     *
     * @returns {boolean} true or false
     */
    isLoggedIn() {
        return (this.auth.person !== undefined && this.auth.person !== null);
    }

    /**
     * Returns true if a person has successfully logged in
     *
     * @returns {boolean} true or false
     */
    isLoading() {
        if (this._loginStatus === "logged-out")
            return false;
        return (!this.isLoggedIn() && this.auth.token !== undefined);
    }


    /**
     * Send a fetch to given url with given options
     *
     * @param url
     * @param options
     * @returns {object} response (error or result)
     */
    async httpGetAsync(url, options) {
        let response = await fetch(url, options).then(result => {
            if (!result.ok) throw result;
            return result;
        }).catch(error => {
            return error;
        });

        return response;
    }

    /**
     * Gets the active checkins of the current logged in user
     *
     * @returns {object} response
     */
    async getActiveCheckIns() {
        let response;

        const options = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/ld+json',
                Authorization: "Bearer " + this.auth.token
            },
        };
        response = await this.httpGetAsync(this.entryPointUrl + '/location_check_in_actions', options);
        return response;
    }

    /**
     * Checkout at a specific location
     *
     * @param  locationHash
     * @param seatNumber (optional)
     * @returns {object} response
     */
    async sendCheckOutRequest(locationHash, seatNumber) {
        let response;

        let body = {
            "location": "/check_in_places/" + locationHash,
            "seatNumber": parseInt(seatNumber),
        };

        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/ld+json',
                Authorization: "Bearer " + this.auth.token
            },
            body: JSON.stringify(body)
        };

        response = await this.httpGetAsync(this.entryPointUrl + '/location_check_out_actions', options);
        return response;
    }

    /**
     * Checkin at a specific location
     *
     * @param  locationHash
     * @param seatNumber (optional)
     * @returns {object} response
     */
    async sendCheckInRequest(locationHash, seatNumber) {
        let body = {
            "location": '/check_in_places/' + locationHash,
            "seatNumber": parseInt(seatNumber),
        };

        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/ld+json',
                Authorization: "Bearer " + this.auth.token
            },
            body: JSON.stringify(body)
        };

        return await this.httpGetAsync(this.entryPointUrl + '/location_check_in_actions', options);
    }

    /**
     * Sends an analytics error event for the request of a room
     *
     * @param category
     * @param action
     * @param room
     * @param responseData
     */
    async sendErrorAnalyticsEvent(category, action, room, responseData = {}) {
        let responseBody = {};

        // Use a clone of responseData to prevent "Failed to execute 'json' on 'Response': body stream already read"
        // after this function, but still a TypeError will occur if .json() was already called before this function
        try {
            responseBody = await responseData.clone().json();
        } catch (e) {
            // NOP
        }

        const data = {
            status: responseData.status || '',
            url: responseData.url || '',
            description: responseBody['hydra:description'] || '',
            room: room,
            // get 5 items from the stack trace
            stack: getStackTrace().slice(1, 6)
        };

        // console.log("sendErrorEvent", data);
        this.sendSetPropertyEvent('analytics-event', {'category': category, 'action': action, 'name': JSON.stringify(data)});
    }


    /**
     * Sends a Checkin request and do error handling and parsing
     * Include message for user when it worked or not
     * Saves invalid QR codes in array in this.wrongHash, so no multiple requests are send
     *
     * Possible paths: checkin, refresh session, invalid input, roomhash wrong, invalid seat number
     * no seat number, already checkedin, no permissions, any other errors, location hash empty
     *
     * @param locationHash
     * @param seatNumber
     * @param locationName
     * @param category
     * @param refresh (default = false)
     * @param setAdditionals (default = false)
     */
    async doCheckIn(locationHash, seatNumber, locationName, category, refresh=false, setAdditionals = false) {
        const i18n = this._i18n;

        // Error: no location hash detected
        if (locationHash.length <= 0) {
            this.saveWrongHashAndNotify(i18n.t('check-in.error-title'), i18n.t('check-in.error-body'), locationHash, seatNumber);
            this.sendSetPropertyEvent('analytics-event', {'category': category, 'action': 'CheckInFailedNoLocationHash'});
            return;
        }

        let responseData = await this.sendCheckInRequest(locationHash, seatNumber);
        await this.checkResponse(responseData, locationHash, seatNumber, locationName, category, refresh, setAdditionals);
    }

    async checkResponse(responseData, locationHash, seatNumber, locationName, category, refresh=false, setAdditionals = false) {
        const i18n = this._i18n;

        let status = responseData.status;
        let responseBody = await responseData.clone().json();

        switch (status) {
            case 201:
                if (setAdditionals) {
                    this.checkedInRoom = responseBody.location.name;
                    this.checkedInSeat = responseBody.seatNumber;
                    this.checkedInEndTime = responseBody.endTime;
                    this.identifier = responseBody['identifier'];
                    this.agent = responseBody['agent'];
                    this.stopQRReader();
                    this.isCheckedIn = true;
                    this._("#text-switch")._active = "";
                    locationName = responseBody.location.name;
                }

                if (refresh) {
                    send({
                        "summary": i18n.t('check-in.success-refresh-title', {room: locationName}),
                        "body": i18n.t('check-in.success-refresh-body', {room: locationName}),
                        "type": "success",
                        "timeout": 5,
                    });

                    this.sendSetPropertyEvent('analytics-event', {'category': category, 'action': 'RefreshSuccess', 'name': locationName});
                }
                else if(category === 'GuestCheckInRequest') {
                    send({
                        "summary": i18n.t('guest-check-in.success-checkin-title', {email: this.guestEmail}),
                        "body": i18n.t('guest-check-in.success-checkin-body', {email: this.guestEmail}),
                        "type": "success",
                        "timeout": 5,
                    });

                    locationName = responseBody.location.name;

                    //Refresh necessary fields and values - keep time and place because it is nice to have for the next guest
                    this._('#email-field').value = '';
                    this.guestEmail = '';

                    this._('#select-seat').value = '';
                    this.seatNr = '';

                    this.isEmailSet = false;
                    this.sendSetPropertyEvent('analytics-event', {'category': category, 'action': 'CheckInSuccess', 'name': locationName});
                }
                else {
                    send({
                        "summary": i18n.t('check-in.success-checkin-title', {room: locationName}),
                        "body": (seatNumber !== '' ? i18n.t('check-in.success-checkin-seat-body', {room: locationName, seat: seatNumber}) : i18n.t('check-in.success-checkin-body', {room: locationName})),
                        "type": "success",
                        "timeout": 5,
                    });

                    this.sendSetPropertyEvent('analytics-event', {'category': category, 'action': 'CheckInSuccess', 'name': locationName});
                }
                await this.checkOtherCheckins();
                break;

            // Invalid Input
            case 400:
                this.saveWrongHashAndNotify(i18n.t('check-in.invalid-input-title'), i18n.t('check-in.invalid-input-body'), locationHash, seatNumber);
                this.sendSetPropertyEvent('analytics-event', {'category': category, 'action': 'CheckInFailed400', 'name': locationName});
                break;

            // No permissions
            case 403:
                this.saveWrongHashAndNotify(i18n.t('check-in.no-permission-title'), i18n.t('check-in.no-permission-body'), locationHash, seatNumber);
                await this.sendErrorAnalyticsEvent(category, 'CheckInFailed403', locationName, responseData);
                break;

            // Error if room not exists
            case 404:
                this.saveWrongHashAndNotify(i18n.t('check-in.hash-false-title'), i18n.t('check-in.hash-false-body'), locationHash, seatNumber);
                this.sendSetPropertyEvent('analytics-event', {'category': category, 'action': 'CheckInFailed404', 'name': locationName});
                break;

            // Can't checkin at provided place
            case 424:
                await this.sendErrorAnalyticsEvent(category, 'CheckInFailed424', locationName, responseData);
                await this.checkErrorDescription(responseBody["hydra:description"], locationHash, seatNumber);
                break;

            // Error: something else doesn't work
            default:
                this.saveWrongHashAndNotify(i18n.t('check-in.error-title'), i18n.t('check-in.error-body'), locationHash, seatNumber);
                this.sendSetPropertyEvent('analytics-event', {'category': category, 'action': 'CheckInFailed', 'name': locationName});
                break;
        }
    }

    async checkErrorDescription(errorDescription, locationHash, seatNumber) {
        const i18n = this._i18n;
        console.log(errorDescription);
        switch (errorDescription) {
            // Error: invalid seat number
            case 'seatNumber must not exceed maximumPhysicalAttendeeCapacity of location!':
            case 'seatNumber too low!':
                this.saveWrongHashAndNotify(i18n.t('check-in.invalid-seatnr-title'), i18n.t('check-in.invalid-seatnr-body'), locationHash, seatNumber);
                break;

            // Error: no seat numbers at provided room
            case 'Location doesn\'t have any seats activated, you cannot set a seatNumber!':
                this.saveWrongHashAndNotify(i18n.t('check-in.no-seatnr-title'), i18n.t('check-in.no-seatnr-body'), locationHash, seatNumber);
                break;

            // Error: no seat given
            case 'Location has seats activated, you need to set a seatNumber!':
                this.saveWrongHashAndNotify(i18n.t('guest-check-in.no-seatnr-title'), i18n.t('guest-check-in.no-seatnr-body'), locationHash, seatNumber);
                break;

            // Error: you are already checked in here
            case 'There are already check-ins at the location with provided seat for the current user!':
                await this.checkOtherCheckins(locationHash, seatNumber, true);
                break;

            // Error: Email is already checked in here
            case 'There are already check-ins at the location with provided seat for the email address!':
                send({
                    "summary": i18n.t('guest-check-in.already-checkin-title'),
                    "body":  i18n.t('guest-check-in.already-checkin-body'),
                    "type": "warning",
                    "timeout": 5,
                });
                break;

            default:
                // Error: the endTime is too high
                if (errorDescription.includes('The endDate can\'t be after ')) {
                    send({
                        "summary": i18n.t('guest-check-in.max-time-title'),
                        "body":  i18n.t('guest-check-in.max-time-body'),
                        "type": "danger",
                        "timeout": 5,
                    });
                }
                break;
        }
    }

    async checkOtherCheckins(locationHash, seatNumber, checkOtherSeats = false) {
        const i18n = this._i18n;

        let getActiveCheckInsResponse = await this.getActiveCheckIns();

        if ( getActiveCheckInsResponse.status !== 200) {
            this.saveWrongHashAndNotify(i18n.t('check-in.error-title'), i18n.t('check-in.error-body'), locationHash, seatNumber);
            return;
        }

        let getActiveCheckInsBody = await getActiveCheckInsResponse.json();
        let checkInsArray = getActiveCheckInsBody["hydra:member"];
        this.checkinCount = checkInsArray.length;
        if (this.checkinCount > 1) {
            this.status = ({
                "summary": i18nKey('check-in.other-checkins-notification-title'),
                "body": i18nKey('check-in.other-checkins-notification-body', {count: 0}),
                "type": "warning",
                "options": {count: this.checkinCount - 1},
            });
        }

        if (!checkOtherSeats)
            return;

        let atActualRoomCheckIn = checkInsArray.filter(x => (x.location.identifier === this.locationHash && x.seatNumber === (seatNumber === '' ? null : parseInt(seatNumber) ) ));
        if (atActualRoomCheckIn.length !== 1) {
            this.saveWrongHashAndNotify(i18n.t('check-in.error-title'), i18n.t('check-in.error-body'), locationHash, seatNumber);
            return;
        }

        this.checkedInRoom = atActualRoomCheckIn[0].location.name;
        this.checkedInEndTime = atActualRoomCheckIn[0].endTime;
        this.checkedInSeat = atActualRoomCheckIn[0].seatNumber;
        this.stopQRReader();
        this.isCheckedIn = true;
        this._("#text-switch")._active = "";

        send({
            "summary": i18n.t('check-in.already-checkin-title'),
            "body":  i18n.t('check-in.already-checkin-body'),
            "type": "warning",
            "timeout": 5,
        });
    }

    saveWrongHashAndNotify(title, body, locationHash, seatNumber) {
        send({
            "summary": title,
            "body": body,
            "type": "danger",
            "timeout": 5,
        });
        this.wrongHash.push(locationHash + '-' + seatNumber);
    }

    /**
     * Do a refresh: sends a checkout request, if this is successfully init a checkin
     * sends an error notification if something wen wrong
     *
     * @param locationHash
     * @param seatNumber
     * @param locationName
     * @param category
     * @param setAdditionals (default = false)
     */
    async refreshSession(locationHash, seatNumber, locationName, category, setAdditionals = false) {
        const i18n = this._i18n;
        let responseCheckout = await this.sendCheckOutRequest(locationHash, seatNumber);
        if (responseCheckout.status === 201) {
            await this.doCheckIn(locationHash, seatNumber, locationName, category, true, setAdditionals);
            return;
        }
        send({
            "summary": i18n.t('check-in.refresh-failed-title'),
            "body":  i18n.t('check-in.refresh-failed-body', {room: locationName}),
            "type": "warning",
            "timeout": 5,
        });

        await this.sendErrorAnalyticsEvent('CheckInRequest', 'RefreshFailed', locationName, responseCheckout);
    }

    /**
     * Parse a incoming date to a readable date
     *
     * @param date
     * @returns {string} readable date
     */
    getReadableDate(date) {
        const i18n = this._i18n;
        let newDate = new Date(date);
        let month = newDate.getMonth() + 1;
        return i18n.t('check-in.checked-in-at', {clock: newDate.getHours() + ":" + ("0" + newDate.getMinutes()).slice(-2)}) + " " + newDate.getDate() + "." + month + "." + newDate.getFullYear();
    }


}