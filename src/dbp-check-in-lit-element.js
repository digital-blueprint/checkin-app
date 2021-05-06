import DBPLitElement from '@dbp-toolkit/common/dbp-lit-element';
import {getStackTrace} from "@dbp-toolkit/common/error";

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
     *
     * @returns {object} response (error or result)
     *
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
     *
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
     *
     * @returns {object} response
     *
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
     *
     * @returns {object} response
     *
     */
    async sendCheckInRequest(locationHash, seatNumber) {
        let response;

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

        response = await this.httpGetAsync(this.entryPointUrl + '/location_check_in_actions', options);

        return response;
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
        const responseBody = await responseData.json();
        const data = {
            status: responseData.status || '',
            url: responseData.url || '',
            description: responseBody['hydra:description'],
            room: room,
            // get 5 items from the stack trace
            stack: getStackTrace().slice(1, 6)
        }

        // console.log("sendErrorEvent", data);
        this.sendSetPropertyEvent('analytics-event', {'category': category, 'action': action, 'name': JSON.stringify(data)});
    }
}