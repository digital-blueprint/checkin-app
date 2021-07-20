import {ScopedElementsMixin} from '@open-wc/scoped-elements';
import {css, html} from 'lit-element';
import * as commonUtils from '@dbp-toolkit/common/utils';
import {LoadingButton, Icon, MiniSpinner} from "@dbp-toolkit/common";
import {TextSwitch} from "./textswitch";
import {CheckInPlaceSelect} from '@dbp-toolkit/check-in-place-select';
import {createInstance} from "./i18n";
import * as commonStyles from "@dbp-toolkit/common/styles";
import {classMap} from "lit-html/directives/class-map";
import select2CSSPath from 'select2/dist/css/select2.min.css';
import { send } from '@dbp-toolkit/common/notification';
import DBPCheckInLitElement from "./dbp-check-in-lit-element";
import * as CheckinStyles from './styles';

class GuestCheckIn extends ScopedElementsMixin(DBPCheckInLitElement) {
    constructor() {
        super();
        this._i18n = createInstance();
        this.lang = this._i18n.language;
        this.entryPointUrl = '';
        this.isRoomSelected = false;
        this.roomCapacity = 0;
        this.locationHash = '';
        this.locationName = '';
        this.guestEmail = '';
        this.seatNr = '';
        this.endTime;
        this.isEmailSet = false;
    }

    static get scopedElements() {
        return {
            'dbp-icon': Icon,
            'dbp-mini-spinner': MiniSpinner,
            'dbp-loading-button': LoadingButton,
            'dbp-textswitch': TextSwitch,
            'dbp-check-in-place-select': CheckInPlaceSelect,
        };
    }

    static get properties() {
        return {
            ...super.properties,
            lang: { type: String },
            entryPointUrl: { type: String, attribute: 'entry-point-url' },
            seatNr: { type: Number, attribute: false },
            guestEmail: { type: String, attribute: false },
            isRoomSelected: { type: Boolean, attribute: false },
            roomCapacity: { type: Number, attribute: false },
            isEmailSet: { type: Boolean, attribute: false }
        };
    }

    connectedCallback() {
        super.connectedCallback();
    }

    update(changedProperties) {
        changedProperties.forEach((oldValue, propName) => {
            switch (propName) {
                case "lang":
                    this._i18n.changeLanguage(this.lang);
                    break;
            }
        });
        super.update(changedProperties);
    }

    /**
     * Processes the event from check-in-place-select 
     * and stores the information into the 
     * correct values.
     *
     * @param event
     */
    processSelectedPlaceInformation(event) {
        this.isRoomSelected = true;
        this.roomCapacity = event.detail.capacity;
        this.locationHash = event.detail.room;
        this.locationName = event.detail.name;
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

    validateEmail(inputText) {
        const mailFormat = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/;
        return inputText.match(mailFormat) ? true : false;
    }

    processEmailInput(event) {
        if (this._('#email-field').value != '') {
            this.guestEmail = this._('#email-field').value;
            this.isEmailSet = true;
        } else { 
            this.isEmailSet = false;
            this.guestEmail = '';
        }
    }

    /**
     * Check if input time is valid and set a valid endTime
     */
    parseTime() {
        let value = this._('#end-time').value;

        let splitted = value.split(':');

        if (splitted.length === 2) {
            const hours = splitted[0];
            const minutes = splitted[1];
            this.endTime = new Date();
            this.endTime.setHours(hours);
            this.endTime.setMinutes(minutes);

            var now = new Date();

            if (!(now.getHours()<hours || (now.getHours()===hours && now.getMinutes()<=minutes))) {
                this.endTime.setTime(this.endTime.getTime() + 86400000); // next day
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
     * @returns {object} response
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
                Authorization: "Bearer " + this.auth.token
            },
            body: JSON.stringify(body)
        };

        response = await this.httpGetAsync(this.entryPointUrl + '/location_guest_check_in_actions', options);

        return response;
    }

    async _onCheckInClicked(event)  {
        let isDisabled = true;
        let button = event.target;
        if(button.disabled) {
            return;
        }
        try {
            button.start();
            await this.initCheckIn();
        } catch {
            isDisabled = false;
        } finally {
            button.stop();
            button.disabled = isDisabled;
        }
    }

    async _atChangeInput(event)  {
        if (this._("#do-manually-checkin") )
            this._("#do-manually-checkin").disabled = !this.isRoomSelected || !this.isEmailSet || (this.isRoomSelected && this.roomCapacity !== null && this.seatNr <= 0);
    }

    /**
     * Checks user input: email, time and
     * Sends a guest checkin request and do error handling and parsing
     * Include message for user when it worked or not
     * Saves invalid QR codes in array in this.wrongHash, so no multiple requests are send
     *
     * Possible paths: guest checkin, invalid input, roomhash wrong, invalid seat number
     *                  no seat number, already checkedin, no permissions, any other errors, location hash empty
     *
     */
    async initCheckIn() {
        const i18n = this._i18n;
        if (!this.validateEmail(this.guestEmail)) {
            send({
                "summary": i18n.t('guest-check-in.invalid-email-address-title'),
                "body":  i18n.t('guest-check-in.invalid-email-address-body'),
                "type": "danger",
                "timeout": 5,
            });
            this.sendSetPropertyEvent('analytics-event', {'category': 'GuestCheckInRequest', 'action': 'GuestCheckInFailedInvalidEmail'});
            return;
        }

        if (!this.parseTime()) {
            send({
                "summary": i18n.t('guest-check-in.no-time-title'),
                "body":  i18n.t('guest-check-in.no-time-body'),
                "type": "danger",
                "timeout": 5,
            });
            return;
        }

        if (this.roomCapacity === null && this.seatNr >= 0) {
            this.seatNr = '';
        }

        let locationHash = this.locationHash;
        let locationName = this.locationName;
        let seatNumber = this.seatNr;
        let category = 'GuestCheckInRequest';

        // Error: no location hash detected
        if (this.locationHash.length <= 0) {
            this.saveWrongHashAndNotify(i18n.t('check-in.error-title'), i18n.t('check-in.error-body'), locationHash, seatNumber);
            this.sendSetPropertyEvent('analytics-event', {'category': category, 'action': 'GuestCheckInFailedNoLocationHash'});
            return;
        }

        let responseData = await this.sendGuestCheckInRequest(this.guestEmail, this.locationHash, this.seatNr, this.endTime);
        await this.checkResponse(responseData, locationHash, seatNumber, locationName, category);

    }

    getCurrentTime() {
        let date = new Date();
        let currentHours = ('0' + (date.getHours() + 1)).slice(-2);
        let currentMinutes = ('0' + date.getMinutes()).slice(-2); 

        return currentHours + ':' + currentMinutes;
    }

    hasPermissions() {
        if (!this.auth.person || !Array.isArray(this.auth.person.roles))
            return false;

        // For backwards compat, remove once the backend is new enough
        if (this.auth.person.roles.includes('ROLE_STAFF'))
            return true;

        if (this.auth.person.roles.includes('ROLE_SCOPE_LOCATION-CHECK-IN-GUEST'))
            return true;

        return false;
    }

    static get styles() {
        // language=css
        return css`
            ${commonStyles.getThemeCSS()}
            ${commonStyles.getGeneralCSS(false)}
            ${commonStyles.getNotificationCSS()}
            ${CheckinStyles.getCheckinCss()}
        


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
                margin: 0 0 0 3px;
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
                margin: 0 0 0 3px;
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
            and (max-width:768px) {

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
        let privacyURL = commonUtils.getAssetURL('dbp-check-in', 'datenschutzerklaerung-tu-graz-check-in.pdf');
        const i18n = this._i18n;
        
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
                </div>
                
                <div class="notification is-danger ${classMap({hidden: this.hasPermissions() || !this.isLoggedIn() || this.isLoading()})}">
                    ${i18n.t('guest-check-in.error-permission-message')}
                </div>
    
                <div class="${classMap({hidden: !this.isLoggedIn() || !this.hasPermissions() || this.isLoading()})}">
    
                    <link rel="stylesheet" href="${select2CSS}">
                    <vpu-notification lang="de" client-id="my-client-id"></vpu-notification>
                    <h2>${i18n.t('guest-check-in.title')}</h2>
    
                    <p class="">${i18n.t('guest-check-in.description')}</p>
                    <p> ${i18n.t('guest-check-in.how-to')}</p>
                    <p> ${i18n.t('guest-check-in.data-protection')} <br>
                    <a href="${privacyURL}" title="${i18n.t('check-in.data-protection-link')}" target="_blank" class="int-link-internal"> 
                        <span>${i18n.t('check-in.data-protection-link')} </span>
                    </a>
                    </p>
                    
                    
                    <div class="border">
                            <div class="container">
                                    <div class="field">
                                        <label class="label">${i18n.t('guest-check-in.email')}</label>
                                        <div class="control">
                                            <input type="email" class="input" id="email-field" placeholder="mail@email.at" name="email" .value="${this.guestEmail}" @input="${(event) => {this.processEmailInput(event); this._atChangeInput(event);}}">
                                        </div>
                                    </div>
                                    <div class="field">
                                        <label class="label">${i18n.t('check-in.manually-place')}</label>
                                        <div class="control">
                                            <dbp-check-in-place-select subscribe="auth" lang="${this.lang}" entry-point-url="${this.entryPointUrl}" @change="${(event) => {this.processSelectedPlaceInformation(event);}}"  @input="${(event) => {this._atChangeInput(event);}}"></dbp-check-in-place-select>
                                        </div>
                                    </div>
                                    <div class="field ${classMap({hidden: !this.isRoomSelected || this.roomCapacity === null})}">
                                        <link rel="stylesheet" href="${select2CSS}">
                                        <label class="label">${i18n.t('check-in.manually-seat')}</label>
                                        <div class="control">
                                            <input class="input" type="text" name="seat-number" .value="${this.seatNr}" id="select-seat" min="1" max="${this.roomCapacity}" placeholder="1-${this.roomCapacity}" maxlength="4" inputmode="numeric" pattern="[0-9]*" ?disabled=${!this.isRoomSelected} @input="${(event) => {this.setSeatNumber(event); this._atChangeInput(event);}}">
                                        </div>
                                    </div>
                                    <div class="field">
                                        <label class="label">${i18n.t('guest-check-in.end-time')}</label>
                                        <div class="control">
                                            <input type="time" class="input" placeholder="hh:mm" id="end-time" name="endTime" .defaultValue="${this.getCurrentTime()}" @input="${(event) => {this._atChangeInput(event);}}">
                                        </div>
                                    </div>
                                <div class="btn">
                                    <dbp-loading-button id="do-manually-checkin" type="is-primary" value="${i18n.t('check-in.manually-checkin-button-text')}" 
                                                        @click="${this._onCheckInClicked}" title="${i18n.t('check-in.manually-checkin-button-text')}" 
                                                        ?disabled=${!this.isRoomSelected || !this.isEmailSet || (this.isRoomSelected && this.roomCapacity !== null && this.seatNr <= 0)}></dbp-loading-button>
                                </div>
                            </div>
                    </div>
               </div>`
        }`;
    }
}

commonUtils.defineCustomElement('dbp-guest-check-in', GuestCheckIn);