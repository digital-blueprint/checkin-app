import {createInstance} from './i18n.js';
import {css, html} from 'lit-element';
import DBPCheckInLitElement from "./dbp-check-in-lit-element";
import {ScopedElementsMixin} from '@open-wc/scoped-elements';
import * as commonUtils from '@dbp-toolkit/common/utils';
import {LoadingButton, Icon, MiniSpinner, InlineNotification} from '@dbp-toolkit/common';
import {classMap} from 'lit-html/directives/class-map.js';
import * as commonStyles from '@dbp-toolkit/common/styles';
import {TextSwitch} from './textswitch.js';
import {QrCodeScanner} from '@dbp-toolkit/qr-code-scanner';
import { send } from '@dbp-toolkit/common/notification';
import {escapeRegExp, parseGreenPassQRCode} from './utils.js';
import * as CheckinStyles from './styles';




class GreenPassActivation extends ScopedElementsMixin(DBPCheckInLitElement) {
    constructor() {
        super();
        this._i18n = createInstance();
        this.lang = this._i18n.language;
        this.entryPointUrl = '';
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
        this.greenPassHash = '';
    }

    static get scopedElements() {
        return {
          'dbp-icon': Icon,
          'dbp-mini-spinner': MiniSpinner,
          'dbp-loading-button': LoadingButton,
          'dbp-textswitch': TextSwitch,
          'dbp-qr-code-scanner': QrCodeScanner,
          'dbp-inline-notification': InlineNotification,
        };
    }

    static get properties() {
        return {
            ...super.properties,
            lang: { type: String },
            entryPointUrl: { type: String, attribute: 'entry-point-url' },
            showManuallyContainer: { type: Boolean, attribute: false},
            showQrContainer: { type: Boolean, attribute: false},
            checkedInStartTime: {type: String, attribute: false},
            checkedInEndTime: { type: String, attribute: false },
            loadingMsg: { type: String, attribute: false },
            searchHashString: { type: String, attribute: 'search-hash-string' },
            loading: {type: Boolean, attribute: false},
            status: { type: Object, attribute: false },
            wrongQR : { type: Array, attribute: false },
            wrongHash : { type: Array, attribute: false },
        };
    }

    connectedCallback() {
        super.connectedCallback();
    }

    update(changedProperties) {
        let that = this;
        changedProperties.forEach((oldValue, propName) => {
            switch (propName) {
                case "lang":
                    this._i18n.changeLanguage(this.lang);
                    break;
                case "status":
                    if (oldValue !== undefined) {
                        setTimeout(function () {
                            that._("#notification-wrapper").scrollIntoView({ behavior: 'smooth', block: 'end' });
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
            await new Promise(r => setTimeout(r, time));
            count_trys ++;
        }
        return responseData;

    }

    resetCheckin(that) {
        that.locationHash = "";
        that.checkedInEndTime = "";

        let checkInPlaceSelect = that.shadowRoot.querySelector(that.getScopedTagName('dbp-check-in-place-select'));
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
    async deleteGreenPass(event) {
        let button = event.target;
        let response;

        button.start();
        try {
            //response = await this.tryCheckOut(this.greenPassHash, this.seatNr);
            response = null;
            //TODO: delete green pass
        } finally {
            button.stop();
        }

        //TODO: send correct response
       // await this.checkCheckoutResponse(response, this.locationHash, this.seatNr, this.checkedInRoom, 'CheckInRequest', this, this.resetCheckin);

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

        if (this._checkInInProgress)
            return;
        this._checkInInProgress = true;
        try {
            let check = await this.decodeUrl(data);
            if (check) {
                // await this.doCheckIn(this.locationHash, this.seatNr, this.checkedInRoom, 'CheckInRequest', false, true);
            }
        } finally {
            this._checkInInProgress = false;
            this.loading = false;
            this.loadingMsg = "";
        }
    }

    async doCheckInManually(event) {
        let button = event.target;
        if (button.disabled) {
            return;
        }
        try {
            button.start();
            // await this.doCheckIn(this.locationHash, this.seatNr, this.checkedInRoom, 'CheckInRequest', false, true);
        } finally {
            button.stop();
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
        let passData;
        try {
            passData = parseGreenPassQRCode(data, this.searchHashString);
        } catch(error) {
            let checkAlreadySend = await this.wrongQR.includes(data);
            if (checkAlreadySend) {
                const that = this;
                if (!this.resetWrongQr) {
                    this.resetWrongQr = true;
                    setTimeout( function () {
                        that.wrongQR.splice(0,that.wrongQR.length);
                        that.wrongQR.length = 0;
                        that.resetWrongQr = false;
                    }, 3000);
                }
                return false;
            }
            this.wrongQR.push(data);
            send({
                "summary": i18n.t('check-in.qr-false-title'),
                "body":  i18n.t('check-in.qr-false-body'),
                "type": "danger",
                "timeout": 5,
            });
            return false;
        }

        this.greenPassHash = passData;

        let checkAlreadySend = await this.wrongHash.includes(this.greenPassHash);
        if (checkAlreadySend) {
            const that = this;
            if (!this.resetWrongHash) {
                this.resetWrongHash = true;
                setTimeout( function () {
                    that.wrongHash.splice(0,that.wrongHash.length);
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
        if ( this._('#qr-scanner') ) {
            this._('#qr-scanner').stopScan = false;
        }
        this._("#roomselectorwrapper").classList.add('hidden');
        this._("#activate-btn").classList.add('hidden');
    }

    /**
     * Show manually room selector container
     * and stop QR code scanner
     *
     */
    showFilePicker() {
        this._("#qr-scanner").stopScan = true;
        this.showQrContainer = false;

        this._("#roomselectorwrapper").scrollIntoView({ behavior: 'smooth', block: 'start' });
        this._("#roomselectorwrapper").classList.remove('hidden');
        this._("#activate-btn").classList.remove('hidden');

        //TODO show filePicker
    }

    doPassUpload(event) {
        if ( this._('#qr-scanner') ) {
            this._('#qr-scanner').stopScan = false;
        }
        this.showManuallyContainer = false;
        this.showQrContainer = false;
        this._("#roomselectorwrapper").classList.add('hidden');
        this._("#activate-btn").classList.add('hidden');
        this._('#btn-container').classList.add('hidden');
        this._("#notification-wrapper").classList.remove('hidden');

        //TODO
    }

    /**
     * Uses textswitch, switches container (manually room select or QR room select
     *
     * @param name
     */
    uploadSwitch(name) {
        if (name === "manual") {
            this.showFilePicker();
        } else {
            this.showQrReader();
        }
    }

    /**
     * Init a session refresh
     *
     * @param event
     */
    async refreshGreenPass(event) {
        let button = event.target;
        button.start();
        try {
            //TODO show uploadSwitch again
            // await this.refreshSession(this.locationHash, this.seatNr, this.checkedInRoom, 'CheckInRequest', true);
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
            ${CheckinStyles.getCheckinCss()}
            

            #notification-wrapper {
                border-top: 1px solid black;
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
            
            .checkins{
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
           
            .inline-notification{
                margin-top: 2rem;
                display: block;
            }


            @media only screen
            and (orientation: portrait)
            and (max-width:768px) {

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
                #select-seat{
                    width: 100%;
                }

                #refresh-btn {
                    margin-top: 0.5rem;
                }
                
                .loading{
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
                this._("#qr-scanner").scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 0);
        });
    }

    render() {
        let privacyURL = commonUtils.getAssetURL('dbp-check-in', 'datenschutzerklaerung-tu-graz-check-in.pdf'); //TODO change to greenpass pdf!
        const matchRegexString = '.*' + escapeRegExp(this.searchHashString) + '.*';
        const i18n = this._i18n;

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
                
                <h2>Grünen Pass aktivieren</h2>
                <div>
                    <p class="">Mit dieser Applikation können Sie ihren Grünen Pass aktivieren.</p>
                    <slot name="additional-information">
                        <p>Hier können Sie einen QR Code scannen oder ein vorhandenes PDF oder PNG hochladen, um Ihren Grünen Pass für die Dauer der Gültigkeit (des Dokuments) zu aktivieren. Bitte beachten Sie, dass Sie sich damit trotzdem noch für Räume bzw. Gebäude extra anmelden müssen, um die 3G-Regeln einzuhalten.</p>
                        <p> 
                            ${i18n.t('check-in.data-protection')} 
                            <a href="${privacyURL}" title="${i18n.t('check-in.data-protection-link')}" target="_blank" class="int-link-internal"> 
                                <span>${i18n.t('check-in.data-protection-link')} </span>
                            </a>
                        </p>
                    </slot>
                </div>
                <div id="btn-container" class="${classMap({hidden: this.isCheckedIn})}">
                    <dbp-textswitch id="text-switch" name1="qr-reader"
                        name2="manual"
                        name="${i18n.t('check-in.qr-button-text')} || File hochladen"
                        class="switch"
                        value1="${i18n.t('check-in.qr-button-text')}"
                        value2="File hochladen"
                        @change=${ (e) => this.uploadSwitch(e.target.name) }></dbp-textswitch>
                </div>
                
                <div class="grid-container border ${classMap({hidden: !this.isCheckedIn})}">
                    <div class="checkins">
                        <span class="header"><strong>${this.checkedInRoom}</strong>${this.checkedInSeat !== null ? html`${i18n.t('check-in.seatNr')}: ${this.checkedInSeat}<br>` : ``}
                        ${i18n.t('check-out.checkin-until')} ${this.getReadableDate(this.checkedInEndTime)}</span>
    
                        <div><div class="btn"><dbp-loading-button type="is-primary" ?disabled="${this.loading}" value="Dokument / Daten löschen" @click="${(event) => { this.deleteGreenPass(event); }}" title="${i18n.t('check-out.button-text')}"></dbp-loading-button></div></div>
                        <div><div class="btn"><dbp-loading-button id="refresh-btn" ?disabled="${this.loading}" value="Aktualisieren" @click="${(event) => { this.refreshGreenPass(event); }}" title="${i18n.t('check-in.refresh-button-text')}"></dbp-loading-button></div></div>
                     </div>
                    ${ this.status ? html`
                        <dbp-inline-notification class="inline-notification" type="${this.status.type}" summary="${i18n.t(this.status.summary)}" 
                                                 body="${i18n.t(this.status.body, this.status.options)}" ></dbp-inline-notification>
                    `: ``}
                    
                    <div class="control ${classMap({hidden: !this.loading})}">
                        <span class="loading">
                            <dbp-mini-spinner text=${this.loadingMsg}></dbp-mini-spinner>
                        </span>
                    </div>
                </div>
                <div id="notification-wrapper" class="hidden">
                    <p>Sie haben Ihren Grünen Pass erfolgreich aktiviert.</p>
                    <dbp-inline-notification type="success" body="Ihr Pass ist noch gültig bis <strong>DD/MM/YYYY hh:mm</strong>."></dbp-inline-notification>
                    <p>oder:</p>
                    <dbp-inline-notification type="warning" summary="Ihr Pass läuft in Kürze ab!"></dbp-inline-notification>
                </div>
                
                <div id="roomselectorwrapper" class="hidden">
                    <p>TODO: open file picker</p>
                </div>
                <dbp-loading-button id="activate-btn" type="is-primary" class="button hidden" @click="${(event) => { this.doPassUpload(event); }}" value="Aktivieren"></dbp-loading-button>
                
                <div class="border ${classMap({hidden: !(this.showQrContainer || this.showManuallyContainer)})}">
                    <div class="element ${classMap({hidden: (this.isCheckedIn && !this.showQrContainer) || this.showManuallyContainer || this.loading})}">
                        <dbp-qr-code-scanner id="qr-scanner" lang="${this.lang}" stop-scan match-regex="${matchRegexString}" @scan-started="${this._onScanStarted}" @code-detected="${(event) => { this.doCheckInWithQR(event);}}"></dbp-qr-code-scanner>
                    </div>
                    <div class="element ${classMap({hidden: (this.isCheckedIn && !this.showManuallyContainer) || this.showQrContainer || this.loading })}">
                
                        <div class="container" id="manual-select">
                            <p> TODO: open file picker </p>
                            <div class="btn">
                                <dbp-loading-button id="activate-btn" type="is-primary" value="Aktivieren" @click="${(event) => { this.doPassUpload(event); }}" title="Aktivieren"></dbp-loading-button>
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

commonUtils.defineCustomElement('dbp-activate-green-pass', GreenPassActivation);
