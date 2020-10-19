import {createI18nInstance} from './i18n.js';
import {css, html} from 'lit-element';
import DBPCheckInLitElement from "./dbp-check-in-lit-element";
import {classMap} from 'lit-html/directives/class-map.js';
import {ScopedElementsMixin} from '@open-wc/scoped-elements';
import * as commonUtils from 'dbp-common/utils';
import {Button, EventBus, Icon, MiniSpinner} from 'dbp-common';
import * as commonStyles from 'dbp-common/styles';
import {TextSwitch} from './textswitch.js';
import {send} from "dbp-common/notification";

const i18n = createI18nInstance();

class CheckOut extends ScopedElementsMixin(DBPCheckInLitElement) {
    constructor() {
        super();
        this.lang = i18n.language;
        this.entryPointUrl = commonUtils.getAPiUrl();
        this.activeCheckins = [];
        this.isRequested = false;
    }

    static get scopedElements() {
        return {
          'dbp-icon': Icon,
          'dbp-mini-spinner': MiniSpinner,
          'dbp-button': Button,
          'dbp-textswitch': TextSwitch,
        };
    }

    static get properties() {
        return {
            lang: { type: String },
            entryPointUrl: { type: String, attribute: 'entry-point-url' },
            activeCheckins: { type: Array, attribute: false },
            isRequested: { type: Boolean, attribute: false },
            isRequestLoading: { type: Boolean, attribute: false },
        };
    }

    connectedCallback() {
        super.connectedCallback();

        this._loginStatus = '';
        this._loginState = [];
        this._bus = new EventBus();
        this._updateAuth = this._updateAuth.bind(this);
        this._bus.subscribe('auth-update', this._updateAuth);
    }

    update(changedProperties) {
        changedProperties.forEach((oldValue, propName) => {
            switch (propName) {
                case "lang":
                    i18n.changeLanguage(this.lang);
                    break;
            }
           
            // console.log(propName, oldValue);
        });

        super.update(changedProperties);
    }

    /**
     *  Request a re-render every time isLoggedIn()/isLoading() changes
     *
     * @param e
     */
    _updateAuth(e) {
        this._loginStatus = e.status;

        let newLoginState = [this.isLoggedIn(), this.isLoading()];
        if (this._loginState.toString() !== newLoginState.toString()) {
            this.requestUpdate();
        }
        this._loginState = newLoginState;
    }

    disconnectedCallback() {
        this._bus.close();

        super.disconnectedCallback();
    }

    /**
     * Returns if a person is set in or not
     *
     * @returns {boolean} true or false
     */
    isLoggedIn() {
        return (window.DBPPerson !== undefined && window.DBPPerson !== null);
    }

    /**
     * Returns true if a person has successfully logged in
     *
     * @returns {boolean} true or false
     */
    isLoading() {
        if (this._loginStatus === "logged-out")
            return false;
        return (!this.isLoggedIn() && window.DBPAuthToken !== undefined);
    }

    /**
     * Init a checkout request at a specific location and send notification if it worked or not
     *
     * @param event
     * @param entry
     */
    async doCheckOut(event, entry) {
        let locationHash = '';
        let seatNr = '';
        let locationName = '';

        if( entry !== undefined) { 
            locationHash = entry['location'] ? entry['location']['identifier'] : '';
            seatNr = entry['seatNumber'];
            locationName = entry['location'] ? entry['location']['name'] : '';
        }
        console.log('location hash: ', locationHash, ', seatnr: ', seatNr, ', location name: ', locationName);
    
        if (locationHash.length === 0) {
            send({
                "summary": i18n.t('check-out.checkout-failed-title'),
                "body":  i18n.t('check-out.checkout-failed-body', {count: parseInt(seatNr), room: locationName}),
                "type": "warning",
                "timeout": 5,
            });
        } else {
            let response = await this.sendCheckOutRequest(locationHash, seatNr);
            console.log(response);

            if (response.status === 201) {
                send({
                    "summary": i18n.t('check-out.checkout-success-title'),
                    "body":  i18n.t('check-out.checkout-success-body', {count: parseInt(seatNr), room: locationName}),
                    "type": "success",
                    "timeout": 5,
                });

                this.isRequested = false;

            } else {
                send({
                    "summary": i18n.t('check-out.checkout-failed-title'),
                    "body":  i18n.t('check-out.checkout-failed-body', {count: parseInt(seatNr), room: locationName}),
                    "type": "warning",
                    "timeout": 5,
                });
            }
        }
    }

    /**
     * Parses the active checkins respons
     *
     * @param response
     *
     * @returns {Array} list
     */
    parseActiveCheckins(response) {
        let list = [];

        let numTypes = parseInt(response['hydra:totalItems']);
        if (isNaN(numTypes)) {
            numTypes = 0;
        }
        for (let i = 0; i < numTypes; i++ ) {
            list[i] = response['hydra:member'][i];
        }
        return list;
    }

    /**
     * Get a list of active checkins
     *
     * @returns {Array} list
     */
    async getListOfActiveCheckins() {
        if (this.isLoggedIn() && !this.isRequested) {
            this.isRequestLoading = true;
            let response = await this.getActiveCheckIns();
            console.log(response);
            let responseBody = await response.json();

            if (responseBody !== undefined && responseBody.status !== 403) {
                this.activeCheckins = this.parseActiveCheckins(responseBody);
                console.log('active checkins: ', this.activeCheckins);
            }
            this.isRequested = true;
            this.isRequestLoading = false;
        }
    }

    /**
     * Init a session refresh
     *
     * @param event
     * @param entry
     */
    doRefreshSession(event, entry) {
        let locationHash = entry['location']['identifier'];
        let seatNr = entry['seatNumber'];
        let locationName = entry['location']['name'];
        
        return this.refreshSession(locationHash, seatNr, locationName);
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
            await this.doCheckIn(locationHash, seatNumber, locationName);
            this.isRequested = false;
            return;
        }
        send({
            "summary": i18n.t('check-in.refresh-failed-title'),
            "body":  i18n.t('check-in.refresh-failed-body', {room: locationName}),
            "type": "warning",
            "timeout": 5,
        });
    }

    /**
     * Sends a Checkin request and do error handling and parsing
     * Include message for user when it worked or not
     * Saves invalid QR codes in array in this.wrongHash, so no multiple requests are send
     *
     * Possible paths: checkin, refresh session, invalid input, roomhash wrong, invalid seat number
     *                  no seat number, already checkedin, no permissions, any other errors, location hash empty
     *
     * @param locationHash
     * @param seatNumber
     * @param locationName
     */
    async doCheckIn(locationHash, seatNumber, locationName) {
         let responseData = await this.sendCheckInRequest(locationHash, seatNumber);
        // When you are checked in
        if (responseData.status === 201) {
            if (this.isSessionRefreshed) {
                this.isSessionRefreshed = false;
                send({
                    "summary": i18n.t('check-in.success-refresh-title', {room: locationName}),
                    "body": i18n.t('check-in.success-refresh-body', {room: locationName}),
                    "type": "success",
                    "timeout": 5,
                });
            } else {
                send({
                    "summary": i18n.t('check-in.success-checkin-title', {room: locationName}),
                    "body": i18n.t('check-in.success-checkin-body', {room: locationName}),
                    "type": "success",
                    "timeout": 5,
                });
            }

        // Invalid Input
        } else if (responseData.status === 400) {
            send({
                "summary": i18n.t('check-in.invalid-input-title'),
                "body":  i18n.t('check-in.invalid-input-body'),
                "type": "danger",
                "timeout": 5,
            });
            console.log("error: Invalid Input.");

        // Error if room not exists
        } else if (responseData.status === 404) {
            send({
                "summary": i18n.t('check-in.hash-false-title'),
                "body":  i18n.t('check-in.hash-false-body'),
                "type": "danger",
                "timeout": 5,
            });

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
            }


            else {
                send({
                    "summary": i18n.t('check-in.error-title'),
                    "body": i18n.t('check-in.error-body'),
                    "type": "danger",
                    "timeout": 5,
                });
            }

        }
        // Error if you don't have permissions
        else if (responseData.status === 403) {
            send({
                "summary": i18n.t('check-in.no-permission-title'),
                "body":  i18n.t('check-in.no-permission-body'),
                "type": "danger",
                "timeout": 5,
            });

        // Error: something else doesn't work
        } else{
            send({
                "summary": i18n.t('check-in.error-title'),
                "body": i18n.t('check-in.error-body'),
                "type": "danger",
                "timeout": 5,
            });
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
        return newDate.getDay() + "." + newDate.getMonth() + "." + newDate.getFullYear() + " " + newDate.getHours() + ":" + ("0" + newDate.getMinutes()).slice(-2);
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
            }

            .checkins {
                display: grid;
                grid-template-columns: repeat(3, max-content);
                column-gap: 15px;
                row-gap: 1.5em;
                align-items: center;
                margin-top: 2em;
            }

            .header {
                display: grid;
                align-items: center;
            }

            .no-checkins {

            }
            
            .border {
                margin-top: 2rem;
                padding-top: 2rem;
                border-top: 1px solid black;
            }


            @media only screen
            and (orientation: portrait)
            and (max-device-width: 765px) {   

                .checkins {
                    display: flex;
                    flex-direction: column;
                    align-items: stretch
                }

                .header {
                    text-align: center;
                }

                #refresh-btn {
                    margin-bottom: 1rem;
                }
            }
        `;
    }

    render() {

        if (this.isLoggedIn() && !this.isLoading()) {
            this.getListOfActiveCheckins();
        }
        
        return html`
            <h2>${i18n.t('check-out.title')}</h2>
            <p>${i18n.t('check-out.description')}</p>
            <div class="border checkins ${classMap({hidden: !this.isLoggedIn() || this.isLoading()})}">
                ${this.activeCheckins.map(i => html`

                    <span class="header"><strong>${i.location.name}</strong>${i.seatNumber !== null ? html`Sitzplatz: ${i.seatNumber}<br>` : ``}
                    Angemeldet seit: ${this.getReadableDate(i.startTime)}</span> 
                    <button class="button is-primary" @click="${(event) => { this.doCheckOut(event, i); }}" title="${i18n.t('check-out.button-text')}">${i18n.t('check-out.button-text')}</button>
                    <button class="button" id="refresh-btn" @click="${(event) => { this.doRefreshSession(event, i); }}" title="${i18n.t('check-in.refresh-button-text')}">${i18n.t('check-in.refresh-button-text')}</button>`)}
                    
                <span class="control ${classMap({hidden: this.isLoggedIn() && !this.isRequestLoading})}">
                    <dbp-mini-spinner text=${i18n.t('check-out.loading-message')}></dbp-mini-spinner>
                </span>
                    
                <div class="no-checkins ${classMap({hidden: !this.isLoggedIn() || this.isRequestLoading || this.activeCheckins.length !== 0})}">${i18n.t('check-out.no-checkins-message')}</div>
            </div>
            
        `;
    }
}

commonUtils.defineCustomElement('dbp-check-out-request', CheckOut);
