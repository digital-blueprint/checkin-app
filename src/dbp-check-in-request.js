import {createI18nInstance} from './i18n.js';
import {css, html} from 'lit-element';
import DBPCheckInLitElement from "./dbp-check-in-lit-element";
import {ScopedElementsMixin} from '@open-wc/scoped-elements';
import * as commonUtils from 'dbp-common/utils';
import {Button, Icon, MiniSpinner} from 'dbp-common';
import {classMap} from 'lit-html/directives/class-map.js';
import * as commonStyles from 'dbp-common/styles';
import {TextSwitch} from './textswitch.js';
import {QrCodeScanner} from 'dbp-qr-code-scanner';
import {LocationSelect} from 'dbp-location-select';
import { send } from 'dbp-common/notification';
import searchQRString from 'consts:searchQRString';

const i18n = createI18nInstance();

class CheckIn extends ScopedElementsMixin(DBPCheckInLitElement) {
    constructor() {
        super();
        this.lang = i18n.language;
        this.entryPointUrl = commonUtils.getAPiUrl();
        this.locationHash = '';
        this.seatNr = '';
        this.isCheckedIn = false;
        this.checkedInRoom = '';
        this.checkedInSeat = null;
        this.checkedInEndTime = '';
        this.identifier = '';
        this.agent = '';
        this.showManuallyContainer = false;
        this.showQrContainer = false;
        this.showBorder = false;
        this.searchHashString = searchQRString;
        this.wrongHash = [];
        this.wrongQR = [];
        this.isRoomSelected = false;
        this.roomCapacity = 0;
        this._checkInInProgress = false;
        this.checkinCount = 0;
    }

    static get scopedElements() {
        return {
          'dbp-icon': Icon,
          'dbp-mini-spinner': MiniSpinner,
          'dbp-button': Button,
          'dbp-textswitch': TextSwitch,
          'dbp-qr-code-scanner': QrCodeScanner,
          'dbp-location-select': LocationSelect,
        };
    }

    static get properties() {
        return {
            lang: { type: String },
            entryPointUrl: { type: String, attribute: 'entry-point-url' },
            locationHash: { type: String, attribute: false },
            seatNr: { type: Number, attribute: false },
            isCheckedIn: { type: Boolean, attribute: false},
            showManuallyContainer: { type: Boolean, attribute: false},
            showQrContainer: { type: Boolean, attribute: false},
            showBorder: { type: Boolean, attribute: false},
            isRoomSelected: {type: Boolean, attribute: false},
            roomCapacity: {type: Number, attribute: false},
            checkedInStartTime: {type: String, attribute: false},
            checkinCount: { type: Number, attribute: false },
            checkedInEndTime: { type: String, attribute: false }
        };
    }

    connectedCallback() {
        super.connectedCallback();

    }

    update(changedProperties) {
        changedProperties.forEach((oldValue, propName) => {
            switch (propName) {
                case "lang":
                    i18n.changeLanguage(this.lang);
                    break;
            }
        });

        super.update(changedProperties);
    }

    /**
     * Init a checkout and Check if it was successful
     *
     *  @returns {object} responseData
     */
    async doCheckOut() {
        let responseData = await this.sendCheckOutRequest(this.locationHash, this.seatNr);
        if (responseData.status === 201) {
            send({
                "summary": i18n.t('check-out.checkout-success-title'),
                "body":  i18n.t('check-out.checkout-success-body', {count: parseInt(this.seatNr), room: this.checkedInRoom}),
                "type": "success",
                "timeout": 5,
            });
            this.isCheckedIn = false;
            this.locationHash = "";
            this.seatNr = "";
            this.checkedInRoom = "";
            this.checkedInSeat = "";
            this.checkedInEndTime = "";
        } else {
            send({
                "summary": i18n.t('check-out.checkout-failed-title'),
                "body":  i18n.t('check-out.checkout-failed-body', {count: parseInt(this.seatNr), room: this.checkedInRoom}),
                "type": "warning",
                "timeout": 5,
            });
        }
        return responseData;
    }

    /**
     * Init a checkin from a QR code scan event
     *
     * @param event
     */
    async doCheckInWithQR(event) {
        let data = event.detail['code'];
        event.stopPropagation();

        if (this._checkInInProgress)
            return;
        this._checkInInProgress = true;
        try {
            let check = await this.decodeUrl(data);
            if (check) {
                await this.doCheckIn();
            }
        } finally {
            this._checkInInProgress = false;
        }
    }

    /**
     * Sends a Checkin request and do error handling and parsing
     * Include message for user when it worked or not
     * Saves invalid QR codes in array in this.wrongHash, so no multiple requests are send
     *
     * Possible paths: checkin, refresh session, invalid input, roomhash wrong, invalid seat number
     *                  no seat number, already checkedin, no permissions, any other errors, location hash empty
     *
     */
    async doCheckIn() {
        console.log('loc: ', this.locationHash, ', seat: ', this.seatNr);

        if (this.roomCapacity === null && this.seatNr >= 0) {
            this.seatNr = '';
        }

        if (this.locationHash.length > 0) {
            let responseData = await this.sendCheckInRequest(this.locationHash, this.seatNr);

            // When you are checked in
            if (responseData.status === 201) {
                let responseBody = await responseData.json();
                console.log("----------", responseBody);
                this.checkedInRoom = responseBody.location.name;
                this.checkedInSeat = responseBody.seatNumber;
                this.checkedInEndTime = responseBody.endTime;
                this.identifier = responseBody['identifier'];
                this.agent = responseBody['agent'];
                this.stopQRReader();
                this.isCheckedIn = true;
                this._("#text-switch")._active = "";

                if (this.isSessionRefreshed) {
                    this.isSessionRefreshed = false;
                    send({
                        "summary": i18n.t('check-in.success-refresh-title', {room: this.checkedInRoom}),
                        "body": i18n.t('check-in.success-refresh-body', {room: this.checkedInRoom}),
                        "type": "success",
                        "timeout": 5,
                    });
                } else {
                    send({
                        "summary": i18n.t('check-in.success-checkin-title', {room: this.checkedInRoom}),
                        "body": i18n.t('check-in.success-checkin-body', {room: this.checkedInRoom}),
                        "type": "success",
                        "timeout": 5,
                    });
                }
                let getActiveCheckInsResponse = await this.getActiveCheckIns();
                if ( getActiveCheckInsResponse.status === 200) {
                    let getActiveCheckInsBody = await getActiveCheckInsResponse.json();
                    let checkInsArray = getActiveCheckInsBody["hydra:member"];
                    this.checkinCount = checkInsArray.length;
                }

            // Invalid Input
            } else if (responseData.status === 400) {
                send({
                    "summary": i18n.t('check-in.invalid-input-title'),
                    "body":  i18n.t('check-in.invalid-input-body'),
                    "type": "danger",
                    "timeout": 5,
                });

            // Error if room not exists
            } else if (responseData.status === 404) {
                send({
                    "summary": i18n.t('check-in.hash-false-title'),
                    "body":  i18n.t('check-in.hash-false-body'),
                    "type": "danger",
                    "timeout": 5,
                });
                this.wrongHash.push(this.locationHash + '-' + this.seatNr);

            // Other errors
            } else if (responseData.status === 424) {
                let errorBody = await responseData.json();
                let errorDescription = errorBody["hydra:description"];
                console.log("err: ", errorDescription);
                console.log("err: ", errorBody);

                // Error: invalid seat number
                if( errorDescription === 'seatNumber must not exceed maximumPhysicalAttendeeCapacity of location!' || errorDescription === 'seatNumber too low!') {
                    send({
                        "summary": i18n.t('check-in.invalid-seatnr-title'),
                        "body":  i18n.t('check-in.invalid-seatnr-body'),
                        "type": "danger",
                        "timeout": 5,
                    });
                    console.log("error: Invalid seat nr");
                    this.wrongHash.push(this.locationHash + '-' + this.seatNr);
                }

                // Error: no seat numbers
                else if( errorDescription === 'Location doesn\'t have any seats activated, you cannot set a seatNumber!') {
                    send({
                        "summary": i18n.t('check-in.no-seatnr-title'),
                        "body":  i18n.t('check-in.no-seatnr-body'),
                        "type": "danger",
                        "timeout": 5,
                    });
                    console.log("error: Room has no seat nr");
                    this.wrongHash.push(this.locationHash + '-' + this.seatNr);
                }

                // Error: you are already checked in here
                else if( errorDescription === 'There are already check-ins at the location with provided seat for the current user!' ) {
                    let getActiveCheckInsResponse = await this.getActiveCheckIns();
                    if ( getActiveCheckInsResponse.status === 200) {
                        let getActiveCheckInsBody = await getActiveCheckInsResponse.json();
                        let checkInsArray = getActiveCheckInsBody["hydra:member"];
                        this.checkinCount = checkInsArray.length;
                        let atActualRoomCheckIn = checkInsArray.filter(x => (x.location.identifier === this.locationHash && x.seatNumber === (this.seatNr === '' ? null : parseInt(this.seatNr) ) ));

                        if (atActualRoomCheckIn.length === 1) {
                            this.checkedInRoom = atActualRoomCheckIn[0].location.name;
                            this.checkedInEndTime = atActualRoomCheckIn[0].endTime;
                            this.checkedInSeat = atActualRoomCheckIn[0].seatNumber;
                            this.stopQRReader();
                            this.isCheckedIn = true;
                            this._("#text-switch")._active = "";
                        } else {
                            send({
                                "summary": i18n.t('check-in.error-title'),
                                "body": i18n.t('check-in.error-body'),
                                "type": "danger",
                                "timeout": 5,
                            });
                            return;
                        }
                    } else {
                        send({
                            "summary": i18n.t('check-in.error-title'),
                            "body": i18n.t('check-in.error-body'),
                            "type": "danger",
                            "timeout": 5,
                        });
                        return;
                    }

                    send({
                        "summary": i18n.t('check-in.already-checkin-title'),
                        "body":  i18n.t('check-in.already-checkin-body'),
                        "type": "warning",
                        "timeout": 5,
                    });
                }

            // Error if you don't have permissions
            } else if (responseData.status === 403) {
                send({
                    "summary": i18n.t('check-in.no-permission-title'),
                    "body":  i18n.t('check-in.no-permission-body'),
                    "type": "danger",
                    "timeout": 5,
                });
                this.wrongHash.push(this.locationHash + '-' + this.seatNr);

            // Error: something else doesn't work
            } else{
                send({
                    "summary": i18n.t('check-in.error-title'),
                    "body": i18n.t('check-in.error-body'),
                    "type": "danger",
                    "timeout": 5,
                });
            }

        // Error: no location hash detected
        } else {
            send({
                "summary": i18n.t('check-in.error-title'),
                "body": i18n.t('check-in.error-body'),
                "type": "danger",
                "timeout": 5,
            });
        }

    }

    /**
     * Stop QR code reader and hide container
     *
     */
    stopQRReader() {
        if (this._("#qr-scanner")) {
            this._("#qr-scanner").stopScan = true;
            this.showManuallyContainer = false;
            this.showQrContainer = false;
            this.showBorder = false;
           /* const that = this;
            this._('#select-seat').addEventListener('keydown', function (e) {
                if (e.keyCode === 13) {
                    console.log("huiii");
                    that.doManuallyCheckin();
                }
            });*/
        } else {
            console.log('error: qr scanner is not available. Is it already stopped?');
        }
    }

    /**
     * Decode data from QR code
     * Check if it is a valid string for this application with this.searchHashString
     * Saves invalid QR codes, so we don't have to process than more than once
     * Check if input QR code is already a invalid QR code
     *
     * @param data
     *
     * @returns {boolean} true if data is valid not yet send QR code data
     * @returns {boolean} false if data is invalid QR code data
     *
     */
    async decodeUrl(data) {
        let index = data.search(this.searchHashString);
        if (index === -1) {
            if ( !this.wrongQR.includes(data) ) {
                this.wrongQR.push(data);
                send({
                    "summary": i18n.t('check-in.qr-false-title'),
                    "body":  i18n.t('check-in.qr-false-body'),
                    "type": "danger",
                    "timeout": 5,
                });
            }
            return false;
        }
        let locationParam = data.substring(index + this.searchHashString.length);
        let checkAlreadySend = await this.wrongHash.includes(locationParam);
        if (checkAlreadySend) {
            return false;
        }
        let splitted = locationParam.split('-');
        if (splitted.length > 1) {
            if (splitted [0] === this.locationHash && splitted[1] === this.seatNr) {
                return false;
            } else {
                this.locationHash = splitted[0];
                this.seatNr = splitted[1];
                return true;
            }
        } else {
            console.log('error: no correct QR code');
            return false;
        }
    }

    /**
     * Start QR code reader and show container
     *
     */
    showQrReader() {
        this.showBorder = true;
        this.showQrContainer = true;
        this.showManuallyContainer = false;
        if( this._('#qr-scanner') ) {
            this._('#qr-scanner').stopScan = false;
        }
    }

    /**
     * Show manually room selector container
     * and stop QR code scanner
     *
     */
    showRoomSelector() {
        this._("#qr-scanner").stopScan = true;
        this.showBorder = true;
        this.showManuallyContainer = true;
        this.showQrContainer = false;

        this._("#roomselectorwrapper").scrollIntoView({ behavior: 'smooth', block: 'start' });
        const that = this;
        this._('#manual-select').addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
               that.doCheckIn();
            }
        });
    }

    /**
     * Processes the event from location-select 
     * and stores the information into the 
     * correct values.
     *
     * @param event
     *
     */
    processSelectedPlaceInformation(event) {
        this.isRoomSelected = true;
        this.roomCapacity = event.detail.capacity;
        this.locationHash = event.detail.room;
    }

    /**
     * Check if input seatnumber is a valid number from 0-this.roomCapacity
     *
     * @param e
     */
    setSeatNumber(e) {
        let val = parseInt(this._('#select-seat').value);
        val = isNaN(val) ? "" : val;
        this.seatNr = Math.min(this.roomCapacity, val);
        this._('#select-seat').value = this.seatNr;
    }

    /**
     * Uses textswitch, switches container (manually room select or QR room select
     *
     * @param name
     *
     */
    checkinSwitch(name) {
        if (name === "manual") {
            this.showRoomSelector();
        } else {
            this.showQrReader();
        }
    }

    /**
     * Parse a incoming date to a readable date
     *
     * @param date
     *
     * @returns {string} readable date
     *
     */
    getReadableDate(date) {
        let newDate = new Date(date);
        return newDate.getDay() + "." + newDate.getMonth() + "." + newDate.getFullYear() + " " + i18n.t('check-in.checked-in-at', {clock: newDate.getHours() + ":" + ("0" + newDate.getMinutes()).slice(-2)});
    }

    /**
     * Init a session refresh
     *
     */
    doRefreshSession() {
        return this.refreshSession(this.locationHash, this.seatNr, this.checkedInRoom);
    }

    /**
     * Do a refresh: sends a checkout request, if this is successfully init a checkin
     * sends an error notification if something wen wrong
     *
     * @param locationHash
     * @param seatNumber
     * @param locationName
     *
     */
    async refreshSession(locationHash, seatNumber, locationName) {
        let responseCheckout = await this.sendCheckOutRequest(locationHash, seatNumber);
        if (responseCheckout.status === 201) {
            this.isSessionRefreshed = true;
            await this.doCheckIn();
            return;
        }
        send({
            "summary": i18n.t('check-in.refresh-failed-title'),
            "body":  i18n.t('check-in.refresh-failed-body', {room: locationName}),
            "type": "warning",
            "timeout": 5,
        });
    }

    static get styles() {
        // language=css
        return css`
            ${commonStyles.getThemeCSS()}
            ${commonStyles.getGeneralCSS(false)}
            ${commonStyles.getButtonCSS()}
            ${commonStyles.getNotificationCSS()}

            h2:first-child {
                margin-top: 0;
            }

            h2 {
                margin-bottom: 10px;
                margin-top: 0px;
            }

            #btn-container {
                margin-top: 1.5rem;
                margin-bottom: 2rem;
            }

            .btn {
                display: contents;
            }

            .element {
                margin-top: 1.5rem;
            }

            .border {
                margin-top: 2rem;
                border-top: 1px solid black;
            }
            
            .grid-container {
                margin-top: 2rem;
                padding-top: 2rem;
                flex-flow: column;
            }
            
            #text-switch {
                display: block;
                width: 50%;
            }

            #select-seat {
                padding-left: 8px;
                font-weight: 300;
                color: inherit;
                border: 1px solid #aaa;
                line-height: 100%;
                margin-bottom: 0.75rem;
                height: 28px;
            }
            
            /* Chrome, Safari, Edge, Opera */
            input::-webkit-outer-spin-button,
            input::-webkit-inner-spin-button {
              -webkit-appearance: none;
              margin: 0;
            }
            
            /* Firefox */
            input[type=number] {
              -moz-appearance: textfield;
            }
            
            .loading{
                text-align: center;
                display: flex;
                justify-content: center;
                padding: 30px;
            }
            
            .int-link-internal{
                transition: background-color 0.15s, color 0.15s;
                border-bottom: 1px solid rgba(0,0,0,0.3);
            }
            
            .int-link-internal:hover{
                background-color: black;
                color: white;
            }
            
            .int-link-internal:after{
                content: "\\00a0\\00a0\\00a0";
                background-image: url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3Ardf%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2F02%2F22-rdf-syntax-ns%23%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20height%3D%228.6836mm%22%20width%3D%225.2043mm%22%20version%3D%221.1%22%20xmlns%3Acc%3D%22http%3A%2F%2Fcreativecommons.org%2Fns%23%22%20xmlns%3Adc%3D%22http%3A%2F%2Fpurl.org%2Fdc%2Felements%2F1.1%2F%22%20viewBox%3D%220%200%2018.440707%2030.768605%22%3E%3Cg%20transform%3D%22translate(-382.21%20-336.98)%22%3E%3Cpath%20style%3D%22stroke-linejoin%3Around%3Bstroke%3A%23000%3Bstroke-linecap%3Around%3Bstroke-miterlimit%3A10%3Bstroke-width%3A2%3Bfill%3Anone%22%20d%3D%22m383.22%20366.74%2016.43-14.38-16.43-14.37%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E');
                background-size: 73%;
                background-repeat: no-repeat;
                background-position: center center;
                margin: 0 0 0 0.75%;
                padding: 0 0 0.25% 0;
                animation: 0.15s linkIconOut;
                font-size: 103%;
            }
            
            .int-link-internal:hover::after{
                content: "\\00a0\\00a0\\00a0";
                background-image: url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3Ardf%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2F02%2F22-rdf-syntax-ns%23%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20height%3D%228.6836mm%22%20width%3D%225.2043mm%22%20version%3D%221.1%22%20xmlns%3Acc%3D%22http%3A%2F%2Fcreativecommons.org%2Fns%23%22%20xmlns%3Adc%3D%22http%3A%2F%2Fpurl.org%2Fdc%2Felements%2F1.1%2F%22%20viewBox%3D%220%200%2018.440707%2030.768605%22%3E%3Cg%20transform%3D%22translate(-382.21%20-336.98)%22%3E%3Cpath%20style%3D%22stroke-linejoin%3Around%3Bstroke%3A%23FFF%3Bstroke-linecap%3Around%3Bstroke-miterlimit%3A10%3Bstroke-width%3A2%3Bfill%3Anone%22%20d%3D%22m383.22%20366.74%2016.43-14.38-16.43-14.37%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E');
                background-size: 73%;
                background-repeat: no-repeat;
                background-position: center center;
                margin: 0 0 0 0.75%;
                padding: 0 0 0.25% 0;
                animation: 0s linkIconIn;
                font-size: 103%;
            }
            
            @keyframes linkIconOut{
                0% {
                    filter: invert(100%);
                    -webkit-filter: invert(100%);
                }
                100% {
                    filter: invert(0%);
                    -webkit-filter: invert(0%);
                }
            }
           
            
            
            @media only screen
            and (orientation: portrait)
            and (max-device-width: 765px) {   
                .inline-block{    
                    width: 100%;
                }

                .btn {
                    display: flex;
                    flex-direction: column;
                    text-align: center;
                    margin-bottom: 0.5rem;
                }
                .logout {
                    width: 100%;
                    box-sizing: border-box;
                }
                
                #text-switch {
                    display: block;
                    width: 100%;
                }
                #select-seat{
                    width: 100%;
                }

                #refresh-btn {
                    margin-top: 0.5rem;
                }
            }
        `;
    }

    _onScanStarted(e) {
        // We want to scroll after the next re-layout
        requestAnimationFrame(() => {
            setTimeout(() => {
                this._("#qr-scanner").scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 0);
        });
    }

    render() {
        return html`

            <div class="notification is-warning ${classMap({hidden: this.isLoggedIn() || this.isLoading()})}">
                ${i18n.t('error-login-message')}
                ${console.log(this.isLoggedIn())}
            </div>

            <div class="control ${classMap({hidden: this.isLoggedIn() || !this.isLoading()})}">
                <span class="loading">
                    <dbp-mini-spinner text=${i18n.t('check-out.loading-message')}></dbp-mini-spinner>
                </span>
            </div>

            <div class="${classMap({hidden: !this.isLoggedIn() || this.isLoading()})}">

                <vpu-notification lang="de" client-id="my-client-id"></vpu-notification>
                <h2>${i18n.t('check-in.title')}</h2>
                <p class="">${i18n.t('check-in.description')}</p>
            
                <div id="btn-container" class="${classMap({hidden: this.isCheckedIn})}">
                    <dbp-textswitch id="text-switch" name1="qr-reader"
                        name2="manual"
                        name="${i18n.t('check-in.qr-button-text')} || ${i18n.t('check-in.manually-button-text')}"
                        class="switch"
                        value1="${i18n.t('check-in.qr-button-text')}"
                        value2="${i18n.t('check-in.manually-button-text')}"
                        @change=${ (e) => this.checkinSwitch(e.target.name) }></dbp-textswitch>
                </div>
            
                <div class="grid-container border ${classMap({hidden: !this.isCheckedIn})}">
                    <h2> ${this.checkedInRoom} </h2> 
                    <p class="${classMap({hidden: !this.isCheckedIn})}">
                        ${this.checkedInSeat ? i18n.t('check-in.checked-in-with-seat-description', {time: this.getReadableDate(this.checkedInEndTime), room: this.checkedInRoom, seat: this.checkedInSeat}) : i18n.t('check-in.checked-in-description', {time: this.getReadableDate(this.checkedInEndTime), room: this.checkedInRoom}) }
                    </p>
                    <div>
                        <button class="logout button is-primary " @click="${this.doCheckOut}" title="${i18n.t('check-out.button-text')}">${i18n.t('check-out.button-text')}</button>
                        <button class="logout button" id="refresh-btn" @click="${this.doRefreshSession}" title="${i18n.t('check-in.refresh-button-text')}">${i18n.t('check-in.refresh-button-text')}</button>
                    </div>
                    
                    <div class="border ${classMap({hidden: this.checkinCount <= 1})}">
                        <p>${i18n.t('check-in.other-checkins', {count: this.checkinCount - 1})}</p>
                        <a href="check-out-request" title="" target="_self" class="int-link-internal"> <span>${i18n.t('check-in.show-other-checkins')}</span></a>
                    </div>
                </div>
                <div id="roomselectorwrapper"></div>
                <div class="border ${classMap({hidden: !this.showBorder})}">
                    <div class="element ${classMap({hidden: !(!this.isCheckedIn && this.showQrContainer)})}">
                        <dbp-qr-code-scanner id="qr-scanner" lang="${this.lang}" stop-scan match-regex=".*tugrazcheckin.*" @scan-started="${this._onScanStarted}" @code-detected="${(event) => { this.doCheckInWithQR(event);}}"></dbp-qr-code-scanner>
                    </div>
                    <div class="element ${classMap({hidden: !(!this.isCheckedIn && this.showManuallyContainer)})}">
                
                        <div class="container" id="manual-select">
                            
                            <div class="field">
                                <label class="label">${i18n.t('check-in.manually-place')}</label>
                                <div class="control">
                                    <dbp-location-select lang="${this.lang}" entry-point-url="${commonUtils.getAPiUrl()}" @change="${(event) => {this.processSelectedPlaceInformation(event);}}"></dbp-location-select>
                                </div>
                            </div>
                            <div class="field ${classMap({hidden: !this.isRoomSelected || this.roomCapacity === null})}">
                                <label class="label">${i18n.t('check-in.manually-seat')}</label>
                                <div class="control">
                                    <input class="input" id="select-seat" type="number" .value="${this.seatNr}" name="seat-number" min="1" max="${this.roomCapacity}" placeholder="1-${this.roomCapacity}" maxlength="4" inputmode="numeric" pattern="[0-9]*" ?disabled=${!this.isRoomSelected} @keyup="${(event) => {this.setSeatNumber(event);}}">
                                </div>
                            </div>
                           
                            <div class="btn"><button id="do-manually-checkin" class="button is-primary" @click="${this.doCheckIn}" title="${i18n.t('check-in.manually-checkin-button-text')}" ?disabled=${!this.isRoomSelected || (this.isRoomSelected && this.roomCapacity !== null && this.seatNr <= 0) }>${i18n.t('check-in.manually-checkin-button-text')}</button></div>
                        </div>
                    </div>  
                </div>
            </div>
        `;
    }
}

commonUtils.defineCustomElement('dbp-check-in-request', CheckIn);
