import {createInstance} from './i18n.js';
import {css, html} from 'lit';
import DBPCheckInLitElement from './dbp-check-in-lit-element';
import {ScopedElementsMixin} from '@dbp-toolkit/common';
import * as commonUtils from '@dbp-toolkit/common/utils';
import {LoadingButton, Icon, MiniSpinner, InlineNotification} from '@dbp-toolkit/common';
import {classMap} from 'lit/directives/class-map.js';
import * as commonStyles from '@dbp-toolkit/common/styles';
import {TextSwitch} from './textswitch.js';
import {QrCodeScanner} from '@dbp-toolkit/qr-code-scanner';
import {CheckInPlaceSelect} from './check-in-place-select.js';
import {send} from '@dbp-toolkit/common/notification';
import {escapeRegExp, parseQRCode} from './utils.js';
import * as CheckinStyles from './styles';
import {Activity} from './activity.js';
import metadata from './dbp-check-in-request.metadata.json';
import {LoginStatus} from '@dbp-toolkit/auth/src/util.js';

class CheckIn extends ScopedElementsMixin(DBPCheckInLitElement) {
    constructor() {
        super();
        this._i18n = createInstance();
        this.lang = this._i18n.language;
        this.activity = new Activity(metadata);
        this.entryPointUrl = '';
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
        this.searchHashString = '';
        this.wrongHash = [];
        this.wrongQR = [];
        this.isRoomSelected = false;
        this.roomCapacity = 0;
        this._checkInInProgress = false;
        this.checkinCount = 0;
        this.loading = false;
        this.loadingMsg = '';
        this.status = null;
        this.resetWrongQr = false;
        this.resetWrongHash = false;
    }

    static get scopedElements() {
        return {
            'dbp-icon': Icon,
            'dbp-mini-spinner': MiniSpinner,
            'dbp-loading-button': LoadingButton,
            'dbp-textswitch': TextSwitch,
            'dbp-qr-code-scanner': QrCodeScanner,
            'dbp-check-in-place-select': CheckInPlaceSelect,
            'dbp-inline-notification': InlineNotification,
        };
    }

    static get properties() {
        return {
            ...super.properties,
            lang: {type: String},
            entryPointUrl: {type: String, attribute: 'entry-point-url'},
            locationHash: {type: String, attribute: false},
            seatNr: {type: Number, attribute: false},
            isCheckedIn: {type: Boolean, attribute: false},
            showManuallyContainer: {type: Boolean, attribute: false},
            showQrContainer: {type: Boolean, attribute: false},
            isRoomSelected: {type: Boolean, attribute: false},
            roomCapacity: {type: Number, attribute: false},
            checkedInStartTime: {type: String, attribute: false},
            checkinCount: {type: Number, attribute: false},
            checkedInEndTime: {type: String, attribute: false},
            loadingMsg: {type: String, attribute: false},
            searchHashString: {type: String, attribute: 'search-hash-string'},
            loading: {type: Boolean, attribute: false},
            status: {type: Object, attribute: false},
            wrongQR: {type: Array, attribute: false},
            wrongHash: {type: Array, attribute: false},
        };
    }

    connectedCallback() {
        super.connectedCallback();
    }

    update(changedProperties) {
        let that = this;
        changedProperties.forEach((oldValue, propName) => {
            switch (propName) {
                case 'lang':
                    this._i18n.changeLanguage(this.lang);
                    break;
                case 'status':
                    if (oldValue !== undefined) {
                        setTimeout(function () {
                            that._('#notification-wrapper').scrollIntoView({
                                behavior: 'smooth',
                                block: 'end',
                            });
                        }, 10);
                    }
                    break;
            }
            //console.log("######", propName);
        });

        super.update(changedProperties);
    }

    async tryCheckOut(locationHash, seat) {
        let count_trys = 0;
        let responseData;
        while (count_trys !== 4) {
            let time = Math.pow(5, count_trys);
            responseData = await this.sendCheckOutRequest(locationHash, seat);
            if (responseData.status === 201) {
                return responseData;
            }
            await new Promise((r) => setTimeout(r, time));
            count_trys++;
        }
        return responseData;
    }

    resetCheckin(that) {
        that.isCheckedIn = false;
        that.locationHash = '';
        that.seatNr = '';
        that.checkedInRoom = '';
        that.checkedInSeat = '';
        that.checkedInEndTime = '';
        that.isRoomSelected = false;

        let checkInPlaceSelect = that.shadowRoot.querySelector('dbp-check-in-place-select');
        if (checkInPlaceSelect !== null) {
            checkInPlaceSelect.clear();
        }
    }

    /**
     * Init a checkout and Check if it was successful
     *
     * @param event
     * @returns {object} responseData
     */
    async doCheckOut(event) {
        let button = event.target;
        let response;

        button.start();
        try {
            response = await this.tryCheckOut(this.locationHash, this.seatNr);
        } finally {
            button.stop();
        }

        await this.checkCheckoutResponse(
            response,
            this.locationHash,
            this.seatNr,
            this.checkedInRoom,
            'CheckInRequest',
            this,
            this.resetCheckin,
        );

        return response;
    }

    /**
     * Init a checkin from a QR code scan event
     *
     * @param event
     */
    async doCheckInWithQR(event) {
        let data = event.detail['code'];
        event.stopPropagation();

        if (this._checkInInProgress) return;
        this._checkInInProgress = true;
        try {
            let check = await this.decodeUrl(data);
            if (check) {
                // set seatnumber to '' if no seat is needed for the specific room
                if (this.roomCapacity === null && this.seatNr >= 0) {
                    this.seatNr = '';
                }
                await this.doCheckIn(
                    this.locationHash,
                    this.seatNr,
                    this.checkedInRoom,
                    'CheckInRequest',
                    false,
                    true,
                );
            }
        } finally {
            this._checkInInProgress = false;
            this.loading = false;
            this.loadingMsg = '';
        }
    }

    async doCheckInManually(event) {
        let button = event.target;
        if (button.disabled) {
            return;
        }
        try {
            button.start();
            // set seatnumber to '' if no seat is needed for the specific room
            if (this.roomCapacity === null && this.seatNr >= 0) {
                this.seatNr = '';
            }
            await this.doCheckIn(
                this.locationHash,
                this.seatNr,
                this.checkedInRoom,
                'CheckInRequest',
                false,
                true,
            );
        } finally {
            button.stop();
        }
    }

    /**
     * Stop QR code reader and hide container
     *
     */
    stopQRReader() {
        if (this._('#qr-scanner')) {
            this._('#qr-scanner').stopScan = true;
            this.showManuallyContainer = false;
            this.showQrContainer = false;
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
     * @returns {boolean} true if data is valid not yet send QR code data
     * @returns {boolean} false if data is invalid QR code data
     */
    async decodeUrl(data) {
        const i18n = this._i18n;
        let location, seat;
        try {
            [location, seat] = parseQRCode(data, this.searchHashString);
        } catch {
            let checkAlreadySend = await this.wrongQR.includes(data);
            if (checkAlreadySend) {
                const that = this;
                if (!this.resetWrongQr) {
                    this.resetWrongQr = true;
                    setTimeout(function () {
                        that.wrongQR.splice(0, that.wrongQR.length);
                        that.wrongQR.length = 0;
                        that.resetWrongQr = false;
                    }, 3000);
                }
                return false;
            }
            this.wrongQR.push(data);
            send({
                summary: i18n.t('check-in.qr-false-title'),
                body: i18n.t('check-in.qr-false-body'),
                type: 'danger',
                timeout: 5,
            });
            return false;
        }

        this.locationHash = location;
        if (seat === null) this.seatNr = '';
        else this.seatNr = seat;

        let locationParam = this.locationHash + '-' + this.seatNr;
        let checkAlreadySend = await this.wrongHash.includes(locationParam);
        if (checkAlreadySend) {
            const that = this;
            if (!this.resetWrongHash) {
                this.resetWrongHash = true;
                setTimeout(function () {
                    that.wrongHash.splice(0, that.wrongHash.length);
                    that.wrongHash.length = 0;
                    that.resetWrongHash = false;
                }, 3000);
            }
        }
        return !checkAlreadySend;
    }

    /**
     * Start QR code reader and show container
     *
     */
    showQrReader() {
        this.showQrContainer = true;
        this.showManuallyContainer = false;
        if (this._('#qr-scanner')) {
            this._('#qr-scanner').stopScan = false;
        }
    }

    /**
     * Show manually room selector container
     * and stop QR code scanner
     *
     */
    showRoomSelector() {
        this._('#qr-scanner').stopScan = true;
        this.showManuallyContainer = true;
        this.showQrContainer = false;

        this._('#roomselectorwrapper').scrollIntoView({behavior: 'smooth', block: 'start'});
        const that = this;
        this._('#manual-select').addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                // set seatnumber to '' if no seat is needed for the specific room
                if (this.roomCapacity === null && this.seatNr >= 0) {
                    this.seatNr = '';
                }
                that.doCheckIn(
                    this.locationHash,
                    this.seatNr,
                    this.checkedInRoom,
                    'CheckInRequest',
                    false,
                    true,
                );
            }
        });
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

    /**
     * Uses textswitch, switches container (manually room select or QR room select
     *
     * @param name
     */
    checkinSwitch(name) {
        if (name === 'manual') {
            this.showRoomSelector();
        } else {
            this.showQrReader();
        }
    }

    /**
     * Init a session refresh
     *
     * @param event
     */
    async doRefreshSession(event) {
        let button = event.target;
        button.start();
        try {
            await this.refreshSession(
                this.locationHash,
                this.seatNr,
                this.checkedInRoom,
                'CheckInRequest',
                true,
            );
        } finally {
            button.stop();
        }
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
                border-top: var(--dbp-border);
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
                border: var(--dbp-border);
                border-color: var(--dbp-muted);
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
            input[type='number'] {
                -moz-appearance: textfield;
            }

            .checkins {
                display: grid;
                grid-template-columns: repeat(3, max-content);
                column-gap: 15px;
                row-gap: 1.5em;
                align-items: center;
            }

            .header {
                display: grid;
                align-items: center;
            }

            .inline-notification {
                margin-top: 2rem;
                display: block;
            }

            @media only screen and (orientation: portrait) and (max-width: 768px) {
                .header {
                    margin-bottom: 0.5rem;
                }

                .btn {
                    display: flex;
                    flex-direction: column;
                    text-align: center;
                }
                .logout {
                    width: 100%;
                    box-sizing: border-box;
                }

                #text-switch {
                    display: block;
                    width: 100%;
                }
                #select-seat {
                    width: 100%;
                }

                #refresh-btn {
                    margin-top: 0.5rem;
                }

                .loading {
                    justify-content: center;
                }

                .checkins {
                    display: block;
                }
            }
        `;
    }

    _onScanStarted(e) {
        // We want to scroll after the next re-layout
        requestAnimationFrame(() => {
            setTimeout(() => {
                this._('#qr-scanner').scrollIntoView({behavior: 'smooth', block: 'start'});
            }, 0);
        });
    }

    _onLoginClicked(e) {
        this.sendSetPropertyEvent('requested-login-status', LoginStatus.LOGGED_IN);
        e.preventDefault();
    }

    render() {
        const matchRegexString = '.*' + escapeRegExp(this.searchHashString) + '.*';
        const i18n = this._i18n;

        return html`
            <div
                class="notification is-warning ${classMap({
                    hidden: this.isLoggedIn() || this.isLoading(),
                })}">
                ${i18n.t('error-login-message')}
                <a href="#" @click="${this._onLoginClicked}">${i18n.t('error-login-link')}</a>
            </div>

            <div class="control ${classMap({hidden: this.isLoggedIn() || !this.isLoading()})}">
                <span class="loading">
                    <dbp-mini-spinner
                        text=${i18n.t('check-out.loading-message')}></dbp-mini-spinner>
                </span>
            </div>

            <div class="${classMap({hidden: !this.isLoggedIn() || this.isLoading()})}">
                <h2>${this.activity.getName(this.lang)}</h2>

                <div>
                    <p class="subheadline">
                        <slot name="description">${this.activity.getDescription(this.lang)}</slot>
                    </p>
                    <slot name="additional-information">
                        <p>${i18n.t('check-in.how-to')}</p>
                        <p>${i18n.t('check-in.data-protection')}</p>
                    </slot>
                </div>

                <div id="btn-container" class="${classMap({hidden: this.isCheckedIn})}">
                    <dbp-textswitch
                        id="text-switch"
                        name1="qr-reader"
                        name2="manual"
                        name="${i18n.t('check-in.qr-button-text')} || ${i18n.t(
                            'check-in.manually-button-text',
                        )}"
                        class="switch"
                        value1="${i18n.t('check-in.qr-button-text')}"
                        value2="${i18n.t('check-in.manually-button-text')}"
                        @change=${(e) => this.checkinSwitch(e.target.name)}></dbp-textswitch>
                </div>

                <div class="grid-container border ${classMap({hidden: !this.isCheckedIn})}">
                    <div class="checkins">
                        <span class="header">
                            <strong>${this.checkedInRoom}</strong>
                            ${this.checkedInSeat !== null
                                ? html`
                                      ${i18n.t('check-in.seatNr')}: ${this.checkedInSeat}
                                      <br />
                                  `
                                : ``}
                            ${i18n.t('check-out.checkin-until')}
                            ${this.getReadableDate(this.checkedInEndTime)}
                        </span>

                        <div>
                            <div class="btn">
                                <dbp-loading-button
                                    type="is-primary"
                                    ?disabled="${this.loading}"
                                    value="${i18n.t('check-out.button-text')}"
                                    @click="${(event) => {
                                        this.doCheckOut(event);
                                    }}"
                                    title="${i18n.t('check-out.button-text')}"></dbp-loading-button>
                            </div>
                        </div>
                        <div>
                            <div class="btn">
                                <dbp-loading-button
                                    id="refresh-btn"
                                    ?disabled="${this.loading}"
                                    value="${i18n.t('check-in.refresh-button-text')}"
                                    @click="${(event) => {
                                        this.doRefreshSession(event);
                                    }}"
                                    title="${i18n.t(
                                        'check-in.refresh-button-text',
                                    )}"></dbp-loading-button>
                            </div>
                        </div>
                    </div>
                    ${this.status
                        ? html`
                              <dbp-inline-notification
                                  class="inline-notification"
                                  type="${this.status.type}"
                                  summary="${i18n.t(this.status.summary)}"
                                  body="${i18n.t(
                                      this.status.body,
                                      this.status.options,
                                  )}"></dbp-inline-notification>
                          `
                        : ``}

                    <div class="control ${classMap({hidden: !this.loading})}">
                        <span class="loading">
                            <dbp-mini-spinner text=${this.loadingMsg}></dbp-mini-spinner>
                        </span>
                    </div>
                </div>
                <div id="notification-wrapper"></div>
                <div id="roomselectorwrapper"></div>
                <div
                    class="border ${classMap({
                        hidden: !(this.showQrContainer || this.showManuallyContainer),
                    })}">
                    <div
                        class="element ${classMap({
                            hidden:
                                (this.isCheckedIn && !this.showQrContainer) ||
                                this.showManuallyContainer ||
                                this.loading,
                        })}">
                        <dbp-qr-code-scanner
                            id="qr-scanner"
                            lang="${this.lang}"
                            stop-scan
                            match-regex="${matchRegexString}"
                            @scan-started="${this._onScanStarted}"
                            @code-detected="${(event) => {
                                this.doCheckInWithQR(event);
                            }}"></dbp-qr-code-scanner>
                    </div>
                    <div
                        class="element ${classMap({
                            hidden:
                                (this.isCheckedIn && !this.showManuallyContainer) ||
                                this.showQrContainer ||
                                this.loading,
                        })}">
                        <div class="container" id="manual-select">
                            <p>${i18n.t('check-in.manual-checkin')}</p>
                            <div class="field">
                                <label class="label">${i18n.t('check-in.manually-place')}</label>
                                <div class="control">
                                    <dbp-check-in-place-select
                                        subscribe="auth"
                                        lang="${this.lang}"
                                        entry-point-url="${this.entryPointUrl}"
                                        @change="${(event) => {
                                            this.processSelectedPlaceInformation(event);
                                        }}"></dbp-check-in-place-select>
                                </div>
                            </div>
                            <div
                                class="field ${classMap({
                                    hidden: !this.isRoomSelected || this.roomCapacity === null,
                                })}">
                                <label class="label">${i18n.t('check-in.manually-seat')}</label>
                                <div class="control">
                                    <input
                                        class="input"
                                        id="select-seat"
                                        type="number"
                                        .value="${this.seatNr}"
                                        name="seat-number"
                                        min="1"
                                        max="${this.roomCapacity}"
                                        placeholder="1-${this.roomCapacity}"
                                        maxlength="4"
                                        inputmode="numeric"
                                        pattern="[0-9]*"
                                        ?disabled=${!this.isRoomSelected}
                                        @keyup="${(event) => {
                                            this.setSeatNumber(event);
                                        }}" />
                                </div>
                            </div>

                            <div class="btn">
                                <dbp-loading-button
                                    id="do-manually-checkin"
                                    type="is-primary"
                                    value="${i18n.t('check-in.manually-checkin-button-text')}"
                                    @click="${this.doCheckInManually}"
                                    title="${i18n.t('check-in.manually-checkin-button-text')}"
                                    ?disabled=${!this.isRoomSelected ||
                                    (this.isRoomSelected &&
                                        this.roomCapacity !== null &&
                                        this.seatNr <= 0)}></dbp-loading-button>
                            </div>
                        </div>
                    </div>
                    <div class="control ${classMap({hidden: !this.loading})}">
                        <span class="loading">
                            <dbp-mini-spinner text=${this.loadingMsg}></dbp-mini-spinner>
                        </span>
                    </div>
                </div>
            </div>
        `;
    }
}

commonUtils.defineCustomElement('dbp-check-in-request', CheckIn);
