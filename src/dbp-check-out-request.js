import {createI18nInstance} from './i18n.js';
import {css, html} from 'lit-element';
import DBPCheckInLitElement from "./dbp-check-in-lit-element";
import {classMap} from 'lit-html/directives/class-map.js';
import {ScopedElementsMixin} from '@open-wc/scoped-elements';
import * as commonUtils from '@dbp-toolkit/common/utils';
import {Icon, MiniSpinner, LoadingButton} from '@dbp-toolkit/common';
import * as commonStyles from '@dbp-toolkit/common/styles';
import {TextSwitch} from './textswitch.js';
import {send} from "@dbp-toolkit/common/notification";

const i18n = createI18nInstance();

class CheckOut extends ScopedElementsMixin(DBPCheckInLitElement) {
    constructor() {
        super();
        this.lang = i18n.language;
        this.entryPointUrl = commonUtils.getAPiUrl();
        this.activeCheckins = [];
        this.loading = false;
        this._initialFetchDone = false;
    }

    static get scopedElements() {
        return {
          'dbp-icon': Icon,
          'dbp-mini-spinner': MiniSpinner,
          'dbp-loading-button': LoadingButton,
          'dbp-textswitch': TextSwitch,
        };
    }

    static get properties() {
        return {
            lang: { type: String },
            entryPointUrl: { type: String, attribute: 'entry-point-url' },
            activeCheckins: { type: Array, attribute: false },
            initialCheckinsLoading: { type: Boolean, attribute: false },
            loading: { type: Boolean, attribute: false },
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
           
            // console.log(propName, oldValue);
        });

        super.update(changedProperties);
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
        let button = event.target;

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

            if (window._paq !== undefined) {
                window._paq.push(['trackEvent', 'CheckOutRequest', 'CheckOutFailed', this.checkedInRoom]);
            }
        } else {
            let response;
            this.loading = true;
            button.start();

            try {
                response = await this.sendCheckOutRequest(locationHash, seatNr);
                await this.getListOfActiveCheckins();
            } finally {
                button.stop();
                this.loading = false;
            }

            if (response.status === 201) {
                send({
                    "summary": i18n.t('check-out.checkout-success-title'),
                    "body":  i18n.t('check-out.checkout-success-body', {count: parseInt(seatNr), room: locationName}),
                    "type": "success",
                    "timeout": 5,
                });

                if (window._paq !== undefined) {
                    window._paq.push(['trackEvent', 'CheckOutRequest', 'CheckOutSuccess', this.checkedInRoom]);
                }
            } else {
                send({
                    "summary": i18n.t('check-out.checkout-failed-title'),
                    "body":  i18n.t('check-out.checkout-failed-body', {count: parseInt(seatNr), room: locationName}),
                    "type": "warning",
                    "timeout": 5,
                });

                if (window._paq !== undefined) {
                    window._paq.push(['trackEvent', 'CheckOutRequest', 'CheckOutFailed', this.checkedInRoom]);
                }
            }
        }
    }

    /**
     * Parses the active checkins response
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
        list.sort(this.compareListItems);

        return list;
    }

    compareListItems(a, b) {
        if (a.location.name < b.location.name) {
            return -1;
        }
        else if (a.location.name > b.location.name) {
            return 1;
        }
        else {
            if (a.seatNumber < b.seatNumber) {
                return -1;
            } else if (a.seatNumber > b.seatNumber) {
                return 1;
            } else {
                return 0;
            }
        }
    }

    /**
     * Get a list of active checkins
     *
     * @returns {Array} list
     */
    async getListOfActiveCheckins() {
        this.initialCheckinsLoading = !this._initialFetchDone;
        try {
            let response = await this.getActiveCheckIns();
            let responseBody = await response.json();
            if (responseBody !== undefined && responseBody.status !== 403) {
                this.activeCheckins = this.parseActiveCheckins(responseBody);
                console.log('active checkins: ', this.activeCheckins);
            }
        } finally {
            this.initialCheckinsLoading = false;
            this._initialFetchDone = true;
        }
    }

    /**
     * Init a session refresh
     *
     * @param event
     * @param entry
     */
    async doRefreshSession(event, entry) {
        let locationHash = entry['location']['identifier'];
        let seatNr = entry['seatNumber'];
        let locationName = entry['location']['name'];
        let button = event.target;
        button.start();
        this.loading = true;
        try {
            await this.refreshSession(locationHash, seatNr, locationName);
        } finally {
            button.stop();
            this.loading = false;
        }
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
            await this.getListOfActiveCheckins();
            return;
        }
        send({
            "summary": i18n.t('check-in.refresh-failed-title'),
            "body":  i18n.t('check-in.refresh-failed-body', {room: locationName}),
            "type": "warning",
            "timeout": 5,
        });

        if (window._paq !== undefined) {
            window._paq.push(['trackEvent', 'CheckOutRequest', 'RefreshFailed', locationName]);
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

                if (window._paq !== undefined) {
                    window._paq.push(['trackEvent', 'CheckOutRequest', 'RefreshSuccess', locationName]);
                }
            } else {
                send({
                    "summary": i18n.t('check-in.success-checkin-title', {room: locationName}),
                    "body": i18n.t('check-in.success-checkin-body', {room: locationName}),
                    "type": "success",
                    "timeout": 5,
                });

                if (window._paq !== undefined) {
                    window._paq.push(['trackEvent', 'CheckOutRequest', 'CheckInSuccess', locationName]);
                }
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

            if (window._paq !== undefined) {
                window._paq.push(['trackEvent', 'CheckOutRequest', 'CheckInFailed400', locationName]);
            }
        // Error if room not exists
        } else if (responseData.status === 404) {
            send({
                "summary": i18n.t('check-in.hash-false-title'),
                "body":  i18n.t('check-in.hash-false-body'),
                "type": "danger",
                "timeout": 5,
            });

            if (window._paq !== undefined) {
                window._paq.push(['trackEvent', 'CheckOutRequest', 'CheckInFailed404', locationName]);
            }
        // Other errors
        } else if (responseData.status === 424) {
            let errorBody = await responseData.json();
            let errorDescription = errorBody["hydra:description"];
            console.log("err: ", errorDescription);
            console.log("err: ", errorBody);

            if (window._paq !== undefined) {
                window._paq.push(['trackEvent', 'CheckOutRequest', 'CheckInFailed424', locationName]);
            }

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

            if (window._paq !== undefined) {
                window._paq.push(['trackEvent', 'CheckOutRequest', 'CheckInFailed403', locationName]);
            }
        // Error: something else doesn't work
        } else{
            send({
                "summary": i18n.t('check-in.error-title'),
                "body": i18n.t('check-in.error-body'),
                "type": "danger",
                "timeout": 5,
            });

            if (window._paq !== undefined) {
                window._paq.push(['trackEvent', 'CheckOutRequest', 'CheckInFailed', locationName]);
            }
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
        let month = newDate.getMonth() + 1;
        let readable = i18n.t('check-in.checked-in-at', {clock: newDate.getHours() + ":" + ("0" + newDate.getMinutes()).slice(-2)}) + " " + newDate.getDate() + "." + month + "." + newDate.getFullYear();
        return readable;
        //return newDate.getHours() + ":" + ("0" + newDate.getMinutes()).slice(-2) + " " + newDate.getDate() + "." + month + "." + newDate.getFullYear();
        //return newDate.getDate() + "." + month + "." + newDate.getFullYear() + " " + newDate.getHours() + ":" + ("0" + newDate.getMinutes()).slice(-2);
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
            
            .loading {
                text-align: center;
                display: flex;
                padding: 30px;
            }


            @media only screen
            and (max-device-width: 765px) {
                .inline-block{    
                    width: 100%;
                }

                .checkins {
                    display: block;
                }

                .header {
                    margin-bottom: 0.5rem;
                }

                #refresh-btn {
                    margin-top: 0.5rem;
                    margin-bottom: 2rem;
                }

                .btn {
                    display: flex;
                    flex-direction: column;
                }
                
                .loading{
                    justify-content: center;
                }
            }
        `;
    }

    render() {
        if (this.isLoggedIn() && !this.isLoading() && !this._initialFetchDone && !this.initialCheckinsLoading) {
            this.getListOfActiveCheckins();
        }
        
        return html`
            <div class="notification is-warning ${classMap({hidden: this.isLoggedIn() || this.isLoading()})}">
                ${i18n.t('error-login-message')}
            </div>

            <div class="control ${classMap({hidden: this.isLoggedIn() || !this.isLoading()})}">
                <span class="loading">
                    <dbp-mini-spinner text=${i18n.t('check-out.loading-message')}></dbp-mini-spinner>
                </span>
            </div>

            <div class="${classMap({hidden: !this.isLoggedIn() || this.isLoading()})}">

                <h2>${i18n.t('check-out.title')}</h2>
                <p>${i18n.t('check-out.description')}</p>
                <div class="border checkins ${classMap({hidden: !this.isLoggedIn() || this.isLoading()})}">
                    ${this.activeCheckins.map(i => html`

                        <span class="header"><strong>${i.location.name}</strong>${i.seatNumber !== null ? html`${i18n.t('check-in.seatNr')}: ${i.seatNumber}<br>` : ``}
                        ${i18n.t('check-out.checkin-until')} ${this.getReadableDate(i.endTime)}</span>

                        <div><div class="btn"><dbp-loading-button type="is-primary" ?disabled="${this.loading}" value="${i18n.t('check-out.button-text')}" @click="${(event) => { this.doCheckOut(event, i); }}" title="${i18n.t('check-out.button-text')}"></dbp-loading-button></div></div>
                        <div><div class="btn"><dbp-loading-button id="refresh-btn" ?disabled="${this.loading}" value="${i18n.t('check-in.refresh-button-text')}" @click="${(event) => { this.doRefreshSession(event, i); }}" title="${i18n.t('check-in.refresh-button-text')}"></dbp-loading-button></div></div>
                    `)}
                    <span class="control ${classMap({hidden: this.isLoggedIn() && !this.initialCheckinsLoading})}">
                        <span class="loading">
                            <dbp-mini-spinner text=${i18n.t('check-out.loading-message')}></dbp-mini-spinner>
                        </span>
                    </span>
                    
                    <div class="no-checkins ${classMap({hidden: !this.isLoggedIn() || this.initialCheckinsLoading || this.activeCheckins.length !== 0})}">${i18n.t('check-out.no-checkins-message')}</div>
                </div>

            </div>
        `;
    }
}

commonUtils.defineCustomElement('dbp-check-out-request', CheckOut);
