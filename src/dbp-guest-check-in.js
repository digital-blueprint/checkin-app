import {ScopedElementsMixin} from '@open-wc/scoped-elements';
import {css, html} from 'lit-element';
import * as commonUtils from 'dbp-common/utils';
import {Button, Icon, MiniSpinner} from "dbp-common";
import {TextSwitch} from "./textswitch";
import {LocationSelect} from "dbp-location-select";
import {createI18nInstance} from "./i18n";
import * as commonStyles from "dbp-common/styles";
import {classMap} from "lit-html/directives/class-map";
import select2CSSPath from 'select2/dist/css/select2.min.css';
import { send } from 'dbp-common/notification';
import DBPCheckInLitElement from "./dbp-check-in-lit-element";

const i18n = createI18nInstance();

class GuestCheckIn extends ScopedElementsMixin(DBPCheckInLitElement) {
    constructor() {
        super();
        this.lang = i18n.language;
        this.entryPointUrl = commonUtils.getAPiUrl();
        this.isRoomSelected = false;
        this.roomCapacity = 0;
        this.locationHash = '';
        this.guestEmail = '';
        this.seatNr = '';
        this.endTime;
    }

    static get scopedElements() {
        return {
            'dbp-icon': Icon,
            'dbp-mini-spinner': MiniSpinner,
            'dbp-button': Button,
            'dbp-textswitch': TextSwitch,
            'dbp-location-select': LocationSelect,
        };
    }

    static get properties() {
        return {
            lang: { type: String },
            entryPointUrl: { type: String, attribute: 'entry-point-url' },
            seatNr: { type: Number, attribute: false },
            guestEmail: { type: String, attribute: false },
            isRoomSelected: { type: Boolean, attribute: false },
            roomCapacity: {type: Number, attribute: false},
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

        console.log("---" + this.roomCapacity + " " + this.seatNr + " " +  this.isRoomSelected);
    }

    validateEmail(inputText) {
        const mailFormat = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/;
        return inputText.match(mailFormat) ? true : false;
    }

    /**
     * Check if input time is valid and set a valid endTime
     */
    parseTime() {
        let value = this._('#end-time').value;
        console.log(value);

        let splitted = value.split(':');

        if (splitted.length == 2) {
            this.endTime = new Date();
            this.endTime.setHours(splitted[0]);
            this.endTime.setMinutes(splitted[1]);

            var now = new Date();
            var maxDate = new Date().setHours(now.getHours() + 3);

            if (this.endTime < now) {
                return 'dateIsPast';
            } else if (this.endTime > maxDate) {
                return 'dateIsTooHigh';
            }
            return true;
        } else {
            return false;
        }
    }

    /**
     * Checkin a guest at a specific location for a specific time frame
     *
     * @param guestEmail
     * @param locationHash
     * @param seatNumber (optional)
     * @param endTime
     *
     * @returns {object} response
     *
     */
    async sendGuestCheckInRequest(guestEmail, locationHash, seatNumber, endTime) {
        let response;

        let body = {
            "location": '/check_in_places/' + locationHash,
            "seatNumber": parseInt(seatNumber),
            "email": guestEmail,
            "endTime": endTime
        };

        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/ld+json',
                Authorization: "Bearer " + window.DBPAuthToken
            },
            body: JSON.stringify(body)
        };

        response = await this.httpGetAsync(this.entryPointUrl + '/location_guest_check_in_actions', options);

        return response;
    }

    /**
     * Sends a guest checkin request and do error handling and parsing
     * Include message for user when it worked or not
     * Saves invalid QR codes in array in this.wrongHash, so no multiple requests are send
     *
     * Possible paths: guest checkin, invalid input, roomhash wrong, invalid seat number
     *                  no seat number, already checkedin, no permissions, any other errors, location hash empty
     *
     */
    async doCheckIn() {
        let email = this._('#email-field').value;
        console.log("this.guestEmail", this.guestEmail);
        if (this.validateEmail(email)) {
            this.guestEmail = email;
        }
        else {
            send({
                "summary": i18n.t('guest-check-in.invalid-email-address-title'),
                "body":  i18n.t('guest-check-in.invalid-email-address-body'),
                "type": "danger",
                "timeout": 5,
            });
            return;
        }

        if (!this.parseTime()) { //TODO check max time??? was passiert wenn given endtime > maxtime from server
            send({
                "summary": i18n.t('guest-check-in.no-time-title'),
                "body":  i18n.t('guest-check-in.no-time-body'),
                "type": "danger",
                "timeout": 5,
            });
            return;
        } else if (this.parseTime() === 'dateIsPast') {
            send({
                "summary": i18n.t('guest-check-in.past-time-title'),
                "body":  i18n.t('guest-check-in.past-time-body'),
                "type": "danger",
                "timeout": 5,
            });
            return;
        } else if (this.parseTime() === 'dateIsTooHigh') {
            send({
                "summary": i18n.t('guest-check-in.max-time-title'),
                "body":  i18n.t('guest-check-in.max-time-body'),
                "type": "danger",
                "timeout": 5,
            });
            return;
        }

        console.log('email: ', this.guestEmail, 'loc: ', this.locationHash, ', seat: ', this.seatNr, 'endTime: ', this.endTime);

        if (this.roomCapacity === null && this.seatNr >= 0) {
            this.seatNr = '';
        }

        if (this.locationHash.length > 0) {
            let responseData = await this.sendGuestCheckInRequest(this.guestEmail, this.locationHash, this.seatNr, this.endTime);

            // When you are checked in
            if (responseData.status === 201) {
                this.isCheckedIn = true;
                
                send({
                        "summary": i18n.t('guest-check-in.success-checkin-title', {email: this.guestEmail}),
                        "body": i18n.t('guest-check-in.success-checkin-body', {email: this.guestEmail}),
                        "type": "success",
                        "timeout": 5,
                });

                //Refresh necessary fields and values - keep time and place because it is nice to have for the next guest
                this._('#email-field').value = '';
                this.guestEmail = '';

                this._('#select-seat').value = '';
                this.seatNumber = '';

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
                }

                // Error: you are already checked in here
                else if( errorDescription === 'There are already check-ins at the location with provided seat for the email address!' ) {  //TODO Change this message
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

    getCurrentTime() {
        let date = new Date();
        let currentHours = ('0' + (date.getHours() + 1)).slice(-2);
        let currentMinutes = ('0' + date.getMinutes()).slice(-2); 

        return currentHours + ':' + currentMinutes;
    }

    hasPermissions() {
        return (window.DBPPerson && Array.isArray(window.DBPPerson.roles) && window.DBPPerson.roles.indexOf('ROLE_STAFF') !== -1);
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
        
            .border {
                margin-top: 2rem;
                border-top: 1px solid black;
            }

            .container {
                margin-top: 2rem;
            }

            .field {
                margin-bottom: 1rem!important;
            }

            #email-field {
                padding-left: 8px;
                font-weight: 300;
                color: inherit;
                border: 1px solid #aaa;
                line-height: 100%;
                height: 28px;
                width: 100%;
            }

            ::placeholder { 
                color: inherit;
                opacity: 1; 
            }

            #select-seat {
                padding-left: 8px;
                font-weight: 300;
                color: inherit;
                border: 1px solid #aaa;
                line-height: 100%;
                height: 28px;
            }

            #end-time {
                padding-left: 8px;
                font-weight: 300;
                color: inherit;
                border: 1px solid #aaa;
                line-height: 100%;
                height: 28px;
            }
            
            .loading {
                text-align: center;
                display: flex;
                justify-content: center;
                padding: 30px;
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

                #select-seat{
                    width: 100%;
                }

                #end-time {
                    width: 100%;
                }
            }
        `;
    }


    render() {
        const select2CSS = commonUtils.getAssetURL(select2CSSPath);
        
        return html`
            <div class="control ${classMap({hidden: this.isLoggedIn() || !this.isLoading()})}">
                <span class="loading">
                    <dbp-mini-spinner text=${i18n.t('check-out.loading-message')}></dbp-mini-spinner>
                </span>
            </div>
        
            ${!this.hasPermissions ? 
            html` 
            <div class="notification is-danger ${classMap({hidden: this.hasPermissions() || !this.isLoggedIn() || this.isLoading()})}">
                ${i18n.t('guest-check-in.error-permission-message')}
            </div>` :
            html`
            <div class="notification is-warning ${classMap({hidden: this.isLoggedIn() || this.isLoading()})}">
                    ${i18n.t('error-login-message')}
                    ${console.log(this.isLoggedIn())}
                </div>
                
                <div class="notification is-danger ${classMap({hidden: this.hasPermissions() || !this.isLoggedIn() || this.isLoading()})}">
                    ${i18n.t('guest-check-in.error-permission-message')}
                </div>
    
                <div class="${classMap({hidden: !this.isLoggedIn() || !this.hasPermissions() || this.isLoading()})}">
    
                    <link rel="stylesheet" href="${select2CSS}">
                    <vpu-notification lang="de" client-id="my-client-id"></vpu-notification>
                    <h2>${i18n.t('guest-check-in.title')}</h2>
    
                    <p class="">${i18n.t('guest-check-in.description')}</p>
                    
                    <div class="border">
      
                            <div class="container">  
                                    <div class="field">
                                        <label class="label">${i18n.t('guest-check-in.email')}</label>
                                        <div class="control">
                                            <input type="text" class="input" id="email-field" placeholder="mail@email.at" name="email">
                                        </div>
                                    </div>
                                    <div class="field">
                                        <label class="label">${i18n.t('check-in.manually-place')}</label>
                                        <div class="control">
                                            <dbp-location-select lang="${this.lang}" entry-point-url="${commonUtils.getAPiUrl()}" @change="${(event) => {this.processSelectedPlaceInformation(event);}}"></dbp-location-select>
                                        </div>
                                    </div>
                                    <div class="field ${classMap({hidden: !this.isRoomSelected || this.roomCapacity === null})}">
                                        <link rel="stylesheet" href="${select2CSS}">
                                        <label class="label">${i18n.t('check-in.manually-seat')}</label>
                                        <div class="control">
                                            <input class="input" type="text" name="seat-number" .value="${this.seatNr}" id="select-seat" min="1" max="${this.roomCapacity}" placeholder="1-${this.roomCapacity}" maxlength="4" inputmode="numeric" pattern="[0-9]*" ?disabled=${!this.isRoomSelected} @input="${(event) => {this.setSeatNumber(event);}}"> <!-- //TODO Styling of arrows -->
                                        </div>
                                    </div>
                                    <div class="field">
                                        <label class="label">${i18n.t('guest-check-in.end-time')}</label>
                                        <div class="control">
                                            <input type="time" class="input" id="end-time" name="endTime" .defaultValue="${this.getCurrentTime()}">
                                        </div>
                                    </div>
                                <div class="btn">
                                    <button id="do-manually-checkin" class="button is-primary" @click="${this.doCheckIn}" title="${i18n.t('check-in.manually-checkin-button-text')}" ?disabled=${!this.isRoomSelected || (this.isRoomSelected && this.roomCapacity !== null && this.seatNr <= 0) }>${i18n.t('check-in.manually-checkin-button-text')}</button>
                                </div>
                            </div>
                        
                    </div>
               </div>`
        }`;
    }
}

commonUtils.defineCustomElement('dbp-guest-check-in', GuestCheckIn);