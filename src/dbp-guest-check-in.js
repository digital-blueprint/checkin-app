import {ScopedElementsMixin} from '@dbp-toolkit/common';
import {css, html} from 'lit';
import * as commonUtils from '@dbp-toolkit/common/utils';
import {LoadingButton, Icon, MiniSpinner} from '@dbp-toolkit/common';
import {TextSwitch} from './textswitch';
import {CheckInPlaceSelect} from './check-in-place-select.js';
import {createInstance} from './i18n';
import * as commonStyles from '@dbp-toolkit/common/styles';
import {classMap} from 'lit/directives/class-map.js';
import select2CSSPath from 'select2/dist/css/select2.min.css';
import {send} from '@dbp-toolkit/common/notification';
import DBPCheckInLitElement from './dbp-check-in-lit-element';
import * as CheckinStyles from './styles';
import {Activity} from './activity.js';
import metadata from './dbp-guest-check-in.metadata.json';
import {LoginStatus} from '@dbp-toolkit/auth/src/util.js';

class GuestCheckIn extends ScopedElementsMixin(DBPCheckInLitElement) {
    constructor() {
        super();
        this._i18n = createInstance();
        this.lang = this._i18n.language;
        this.activity = new Activity(metadata);
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
            lang: {type: String},
            entryPointUrl: {type: String, attribute: 'entry-point-url'},
            seatNr: {type: Number, attribute: false},
            guestEmail: {type: String, attribute: false},
            isRoomSelected: {type: Boolean, attribute: false},
            roomCapacity: {type: Number, attribute: false},
            isEmailSet: {type: Boolean, attribute: false},
        };
    }

    connectedCallback() {
        super.connectedCallback();
    }

    update(changedProperties) {
        changedProperties.forEach((oldValue, propName) => {
            switch (propName) {
                case 'lang':
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
        val = isNaN(val) ? '' : val;
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

            if (
                !(
                    now.getHours() < hours ||
                    (now.getHours() === hours && now.getMinutes() <= minutes)
                )
            ) {
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
            location: '/checkin/places/' + locationHash,
            seatNumber: parseInt(seatNumber),
            email: guestEmail,
            endTime: endTime,
        };

        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/ld+json',
                Authorization: 'Bearer ' + this.auth.token,
            },
            body: JSON.stringify(body),
        };

        response = await this.httpGetAsync(
            this.entryPointUrl + '/checkin/guest-check-in-actions',
            options,
        );

        return response;
    }

    async _onCheckInClicked(event) {
        let isDisabled = true;
        let button = event.target;
        if (button.disabled) {
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

    async _atChangeInput(event) {
        if (this._('#do-manually-checkin'))
            this._('#do-manually-checkin').disabled =
                !this.isRoomSelected ||
                !this.isEmailSet ||
                (this.isRoomSelected && this.roomCapacity !== null && this.seatNr <= 0);
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
                summary: i18n.t('guest-check-in.invalid-email-address-title'),
                body: i18n.t('guest-check-in.invalid-email-address-body'),
                type: 'danger',
                timeout: 5,
            });
            this.sendSetPropertyEvent('analytics-event', {
                category: 'GuestCheckInRequest',
                action: 'GuestCheckInFailedInvalidEmail',
            });
            return;
        }

        if (!this.parseTime()) {
            send({
                summary: i18n.t('guest-check-in.no-time-title'),
                body: i18n.t('guest-check-in.no-time-body'),
                type: 'danger',
                timeout: 5,
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
            this.saveWrongHashAndNotify(
                i18n.t('check-in.error-title'),
                i18n.t('check-in.error-body'),
                locationHash,
                seatNumber,
            );
            this.sendSetPropertyEvent('analytics-event', {
                category: category,
                action: 'GuestCheckInFailedNoLocationHash',
            });
            return;
        }

        let responseData = await this.sendGuestCheckInRequest(
            this.guestEmail,
            this.locationHash,
            this.seatNr,
            this.endTime,
        );
        await this.checkCheckinResponse(
            responseData,
            locationHash,
            seatNumber,
            locationName,
            category,
        );
    }

    getCurrentTime() {
        let date = new Date();
        let currentHours = ('0' + (date.getHours() + 1)).slice(-2);
        let currentMinutes = ('0' + date.getMinutes()).slice(-2);

        return currentHours + ':' + currentMinutes;
    }

    hasPermissions() {
        if (!this.auth.person || !Array.isArray(this.auth.person.roles)) return false;

        if (this.auth.person.roles.includes('ROLE_SCOPE_LOCATION-CHECK-IN-GUEST')) return true;

        return false;
    }

    _onLoginClicked(e) {
        this.sendSetPropertyEvent('requested-login-status', LoginStatus.LOGGED_IN);
        e.preventDefault();
    }

    static get styles() {
        // language=css
        return css`
            ${commonStyles.getThemeCSS()}
            ${commonStyles.getGeneralCSS(false)}
            ${commonStyles.getNotificationCSS()}
            ${commonStyles.getActivityCSS()}
            ${CheckinStyles.getCheckinCss()}
            ${commonStyles.getLinkCss()}

            h2 {
                margin-top: 0;
                margin-bottom: 0px;
            }

            .field {
                margin-bottom: 1rem !important;
            }

            #email-field {
                padding-left: 8px;
                font-weight: 300;
                color: inherit;
                border: var(--dbp-border);
                border-color: var(--dbp-muted);
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
                border: var(--dbp-border);
                border-color: var(--dbp-muted);
                line-height: 100%;
                height: 28px;
            }

            #end-time {
                padding-left: 8px;
                font-weight: 300;
                color: inherit;
                border: var(--dbp-border);
                border-color: var(--dbp-muted);
                line-height: 100%;
                height: 28px;
            }

            @media only screen and (orientation: portrait) and (max-width: 768px) {
                .btn {
                    display: flex;
                    flex-direction: column;
                    text-align: center;
                    margin-bottom: 0.5rem;
                }

                #select-seat {
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
        const i18n = this._i18n;

        return html`
            <div class="control ${classMap({hidden: this.isLoggedIn() || !this.isLoading()})}">
                <span class="loading">
                    <dbp-mini-spinner
                        text=${i18n.t('check-out.loading-message')}></dbp-mini-spinner>
                </span>
            </div>

            <div
                class="notification is-danger ${classMap({
                    hidden: this.hasPermissions() || !this.isLoggedIn() || this.isLoading(),
                })}">
                ${i18n.t('guest-check-in.error-permission-message')}
            </div>
            <div
                class="notification is-warning ${classMap({
                    hidden: this.isLoggedIn() || this.isLoading() || !this.hasPermissions(),
                })}">
                ${i18n.t('error-login-message')}
                <a href="#" @click="${this._onLoginClicked}">${i18n.t('error-login-link')}</a>
            </div>

            <div
                class="${classMap({
                    hidden: !this.isLoggedIn() || !this.hasPermissions() || this.isLoading(),
                })}">
                <link rel="stylesheet" href="${select2CSS}" />

                <h2>${this.activity.getName(this.lang)}</h2>
                <p class="subheadline">
                    <slot name="description">${this.activity.getDescription(this.lang)}</slot>
                </p>

                <slot name="activity-description">
                    <p>${i18n.t('guest-check-in.how-to')}</p>
                    <p>${i18n.t('guest-check-in.data-protection')}</p>
                </slot>

                ${this.hasPermissions()
                    ? html`
                          <div class="border">
                              <div class="container">
                                  <div class="field">
                                      <label class="label">${i18n.t('guest-check-in.email')}</label>
                                      <div class="control">
                                          <input
                                              type="email"
                                              class="input"
                                              id="email-field"
                                              placeholder="mail@email.at"
                                              name="email"
                                              .value="${this.guestEmail}"
                                              @input="${(event) => {
                                                  this.processEmailInput(event);
                                                  this._atChangeInput(event);
                                              }}" />
                                      </div>
                                  </div>
                                  <div class="field">
                                      <label class="label">
                                          ${i18n.t('check-in.manually-place')}
                                      </label>
                                      <div class="control">
                                          <dbp-check-in-place-select
                                              subscribe="auth"
                                              lang="${this.lang}"
                                              entry-point-url="${this.entryPointUrl}"
                                              @change="${(event) => {
                                                  this.processSelectedPlaceInformation(event);
                                              }}"
                                              @input="${(event) => {
                                                  this._atChangeInput(event);
                                              }}"></dbp-check-in-place-select>
                                      </div>
                                  </div>
                                  <div
                                      class="field ${classMap({
                                          hidden:
                                              !this.isRoomSelected || this.roomCapacity === null,
                                      })}">
                                      <link rel="stylesheet" href="${select2CSS}" />
                                      <label class="label">
                                          ${i18n.t('check-in.manually-seat')}
                                      </label>
                                      <div class="control">
                                          <input
                                              class="input"
                                              type="text"
                                              name="seat-number"
                                              .value="${this.seatNr}"
                                              id="select-seat"
                                              min="1"
                                              max="${this.roomCapacity}"
                                              placeholder="1-${this.roomCapacity}"
                                              maxlength="4"
                                              inputmode="numeric"
                                              pattern="[0-9]*"
                                              ?disabled=${!this.isRoomSelected}
                                              @input="${(event) => {
                                                  this.setSeatNumber(event);
                                                  this._atChangeInput(event);
                                              }}" />
                                      </div>
                                  </div>
                                  <div class="field">
                                      <label class="label">
                                          ${i18n.t('guest-check-in.end-time')}
                                      </label>
                                      <div class="control">
                                          <input
                                              type="time"
                                              class="input"
                                              placeholder="hh:mm"
                                              id="end-time"
                                              name="endTime"
                                              .defaultValue="${this.getCurrentTime()}"
                                              @input="${(event) => {
                                                  this._atChangeInput(event);
                                              }}" />
                                      </div>
                                  </div>
                                  <div class="btn">
                                      <dbp-loading-button
                                          id="do-manually-checkin"
                                          type="is-primary"
                                          value="${i18n.t('check-in.manually-checkin-button-text')}"
                                          @click="${this._onCheckInClicked}"
                                          title="${i18n.t('check-in.manually-checkin-button-text')}"
                                          ?disabled=${!this.isRoomSelected ||
                                          !this.isEmailSet ||
                                          (this.isRoomSelected &&
                                              this.roomCapacity !== null &&
                                              this.seatNr <= 0)}></dbp-loading-button>
                                  </div>
                              </div>
                          </div>
                      `
                    : html``}
            </div>
        `;
    }
}

commonUtils.defineCustomElement('dbp-guest-check-in', GuestCheckIn);
