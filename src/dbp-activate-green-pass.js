import {createInstance} from './i18n.js';
import {css, html} from 'lit-element';
import DBPCheckInLitElement from "./dbp-check-in-lit-element";
import {ScopedElementsMixin} from '@open-wc/scoped-elements';
import * as commonUtils from '@dbp-toolkit/common/utils';
import {LoadingButton, Icon, MiniSpinner, InlineNotification} from '@dbp-toolkit/common';
import {FileSource} from '@dbp-toolkit/file-handling';
import {classMap} from 'lit-html/directives/class-map.js';
import * as commonStyles from '@dbp-toolkit/common/styles';
import {TextSwitch} from './textswitch.js';
import {QrCodeScanner} from '@dbp-toolkit/qr-code-scanner';
import { send } from '@dbp-toolkit/common/notification';
import {escapeRegExp, parseGreenPassQRCode} from './utils.js';
import {humanFileSize} from "@dbp-toolkit/common/i18next";
import * as CheckinStyles from './styles';




class GreenPassActivation extends ScopedElementsMixin(DBPCheckInLitElement) {
    constructor() {
        super();
        this._i18n = createInstance();
        this.lang = this._i18n.language;
        this.entryPointUrl = '';
        this.activationStartTime = '';
        this.activationEndTime = '';
        this.identifier = '';
        this.agent = '';
        this.showManuallyContainer = false;
        this.showQrContainer = false;
        this.searchHashString = '';
        this.wrongHash = [];
        this.wrongQR = [];
        this._activationInProgress = false;
        this.loading = false;
        this.loadingMsg = '';
        this.status = null;
        this.resetWrongQr = false;
        this.resetWrongHash = false;
        this.greenPassHash = '';
        this.isActivated = false;
        this.isRefresh = false;
        this.QRCodeFile = '';

        this.fileHandlingEnabledTargets = 'local';

        this.nextcloudWebAppPasswordURL = '';
        this.nextcloudWebDavURL = '';
        this.nextcloudName = '';
        this.nextcloudFileURL = '';
        this.nextcloudAuthInfo = '';
    }

    static get scopedElements() {
        return {
          'dbp-icon': Icon,
          'dbp-mini-spinner': MiniSpinner,
          'dbp-loading-button': LoadingButton,
          'dbp-textswitch': TextSwitch,
          'dbp-qr-code-scanner': QrCodeScanner,
          'dbp-inline-notification': InlineNotification,
          'dbp-file-source': FileSource,
        };
    }

    static get properties() {
        return {
            ...super.properties,
            lang: { type: String },
            entryPointUrl: { type: String, attribute: 'entry-point-url' },
            showManuallyContainer: { type: Boolean, attribute: false},
            showQrContainer: { type: Boolean, attribute: false},
            activationStartTime: {type: String, attribute: false},
            activationEndTime: { type: String, attribute: false },
            loadingMsg: { type: String, attribute: false },
            searchHashString: { type: String, attribute: 'gp-search-hash-string' },
            loading: {type: Boolean, attribute: false},
            status: { type: Object, attribute: false },
            wrongQR : { type: Array, attribute: false },
            wrongHash : { type: Array, attribute: false },
            isActivated: { type: Boolean, attribute: false },
            isRefresh: { type: Boolean, attribute: false },
            QRCodeFile: { type: Object, attribute: false },

            fileHandlingEnabledTargets: {type: String, attribute: 'file-handling-enabled-targets'},
            nextcloudWebAppPasswordURL: { type: String, attribute: 'nextcloud-web-app-password-url' },
            nextcloudWebDavURL: { type: String, attribute: 'nextcloud-webdav-url' },
            nextcloudName: { type: String, attribute: 'nextcloud-name' },
            nextcloudFileURL: { type: String, attribute: 'nextcloud-file-url' },
            nextcloudAuthInfo: {type: String, attribute: 'nextcloud-auth-info'},
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

    /**
     * Activate Green Pass
     *
     * @param greenPassHash
     * @returns {object} response
     */
    async sendActivationRequest(greenPassHash) {
        let body = {
            "greenPass": '/activate_green_pass/' + greenPassHash, //TODO change to correct request body
        };

        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/ld+json',
                Authorization: "Bearer " + this.auth.token
            },
            body: JSON.stringify(body)
        };

        return await this.httpGetAsync(this.entryPointUrl + '/green_pass_activation_actions', options); //TODO change to correct request url
    }

    async tryDeleteActivation(gpHash) {
        let count_trys = 0;
        let responseData;
        while (count_trys !== 4) {

            let time = Math.pow(5, count_trys);
            responseData = 'response'; //await this.sendCheckOutRequest(gpHash); //TODO change to correct request
            if (responseData.status === 201) {
                return responseData;
            }
            await new Promise(r => setTimeout(r, time));
            count_trys ++;
        }
        return responseData;

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
            //response = await this.tryDeleteActivation(this.greenPassHash);
            response = 'response';
            //TODO: delete green pass
        } finally {
            button.stop();
        }

        //TODO: send correct response
       // await this.checkCheckoutResponse(response, this.greenPassHash, 'CheckInRequest', this, this.resetCheckin);

        return response;
    }

    /**
     * Sends an Activation request and do error handling and parsing
     * Include message for user when it worked or not
     * Saves invalid QR codes in array in this.wrongHash, so no multiple requests are send
     *
     * Possible paths: activation, refresh session, invalid input, gp hash wrong
     * already activated, no permissions, any other errors, gp hash empty
     *
     * @param greenPassHash
     * @param category
     * @param refresh (default = false)
     * @param setAdditional (default = false)
     */
    async doActivation(greenPassHash, category, refresh = false, setAdditional = false) {
        const i18n = this._i18n;

        // Error: no location hash detected
        if (greenPassHash.length <= 0) {
            this.saveWrongHashAndNotify(i18n.t('check-in.error-title'), i18n.t('check-in.error-body'), greenPassHash);
            this.sendSetPropertyEvent('analytics-event', {'category': category, 'action': 'ActivationFailedNoGreenPassHash'});
            return;
        }

        let responseData = { status: 201 }; //await this.sendActivationRequest(greenPassHash); //TODO change to correct request
        await this.checkActivationResponse(responseData, greenPassHash, category, refresh, setAdditional);
    }

    /**
     * Init a checkin from a QR code scan event
     *
     * @param event
     */
    async doActivationWithQR(event) {
        let data = event.detail['code'];
        event.stopPropagation();

        if (this._activationInProgress)
            return;
        this._activationInProgress = true;
        try {
            let check = await this.decodeUrl(data);
            if (check) {
                await this.doActivation(this.greenPassHash, 'ActivationRequest', false, true);
            }
        } finally {
            this._activationInProgress = false;
            this.loading = false;
            this.loadingMsg = "";
        }
    }

    async doActivationManually(event) {
        let button = event.target;
        if (button.disabled) {
            return;
        }
        try {
            button.start();
            await this.doActivation(this.greenPassHash, 'ActivationRequest', false, true);
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
                "body":  "Dieser QR Code ist kein gültiger Grüner Pass QR Code. Bitten benutzen Sie einen anderen oder wählen Sie beim Check-in die Variante XXXX aus.",
                "type": "danger",
                "timeout": 5,
            });
            return false;
        }

        this.greenPassHash = passData;
        console.log('no error, ', passData);

        let gpAlreadySend = await this.wrongHash.includes(this.greenPassHash);
        if (gpAlreadySend) { //TODO: what should we actually do if this qr code was already uploaded? Change code according to this.
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
        return !gpAlreadySend;
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
        this._("#manualPassUploadWrapper").classList.add('hidden');
    }

    /**
     * Show manually room selector container
     * and stop QR code scanner
     *
     */
    showFilePicker() {
        this._("#qr-scanner").stopScan = true;
        this.showQrContainer = false;

        this._("#manualPassUploadWrapper").scrollIntoView({ behavior: 'smooth', block: 'start' });
        this._("#manualPassUploadWrapper").classList.remove('hidden');

        //TODO show filePicker
    }

    doPassUpload(event) {
        if ( this._('#qr-scanner') ) {
            this._('#qr-scanner').stopScan = false;
        }
        this.showManuallyContainer = false;
        this.showQrContainer = false;
        this._("#manualPassUploadWrapper").classList.add('hidden');
        this._('#btn-container').classList.add('hidden');
        this._("#notification-wrapper").classList.remove('hidden');

        this.isActivated = true; //TODO
    }

    /**
     * Parse an incoming date to a readable date
     *
     * @param date
     * @returns {string} readable date
     */
    getReadableActivationDate(date) {
        let newDate = new Date(date);
        let month = newDate.getMonth() + 1;
        return newDate.getDate() + "." + month + "." + newDate.getFullYear() + ' um ' + newDate.getHours() + ":" + ("0" + newDate.getMinutes()).slice(-2); //TODO i18n
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
            this.isRefresh = true;
            //await this.sendActivationRequest(this.greenPassHash); //TODO
        } finally {
            button.stop();
        }
    }

    /**
     * Parse the response of a checkin or guest checkin request
     * Include message for user when it worked or not
     * Saves invalid QR codes in array in this.wrongHash, so no multiple requests are send
     *
     * Possible paths: checkin, refresh session, invalid input, roomhash wrong, invalid seat number
     * no seat number, already checkedin, no permissions, any other errors, location hash empty
     *
     * @param responseData
     * @param greenPassHash
     * @param category
     * @param refresh (default = false)
     * @param setAdditional (default = false)
     */
    async checkActivationResponse(responseData, greenPassHash, category, refresh=false, setAdditional = false) {
        //const i18n = this._i18n; //TODO replace hardcoded text with i18n values

        let status = responseData.status;
        let responseBody = {endTime: new Date()}; //await responseData.clone().json(); //TODO change this after correct request
        switch (status) {
            case 201:
                if (setAdditional) {
                    this.activationEndTime = responseBody.endTime;
                    //this.identifier = responseBody['identifier'];
                    //this.agent = responseBody['agent'];
                    this.stopQRReader();
                    this.isActivated = true;
                    this._("#text-switch")._active = "";
                }

                send({
                    "summary": "Erfolgreiche Aktivierung",
                    "body": "Ihr Grüner Pass wurde erfolgreich aktiviert.",
                    "type": "success",
                    "timeout": 5,
                });

                //this.sendSetPropertyEvent('analytics-event', {'category': category, 'action': 'ActivationSuccess', 'name': locationName});
                //await this.checkOtherCheckins(locationHash, seatNumber); //TODO
                break;

            // Invalid Input
            case 400:
                //this.saveWrongHashAndNotify(i18n.t('check-in.invalid-input-title'), i18n.t('check-in.invalid-input-body'), locationHash, seatNumber);
                //this.sendSetPropertyEvent('analytics-event', {'category': category, 'action': 'ActivationFailed400', 'name': locationName});
                console.log('error 400');
                break;

            // Error: something else doesn't work
            default:
                break;
        }
    }

    /*
     * Open the file source
     *
     */
    openFileSource() {
        const fileSource = this._("#file-source");
        if (fileSource) {
            this._("#file-source").openDialog();
        }
    }

    getFilesToActivate(event) {
        this.QRCodeFile = event.detail.file;
    }

    getFileData() {
        let data = html``;
        if (this.QRCodeFile) {
            data = html`<span class="header"><strong>${this.QRCodeFile.name}</strong>${humanFileSize(this.QRCodeFile.size)}</span>`;
        }
        return data;
    }

    static get styles() {
        // language=css
        return css`
            ${commonStyles.getThemeCSS()}
            ${commonStyles.getGeneralCSS(false)}
            ${commonStyles.getNotificationCSS()}
            ${CheckinStyles.getCheckinCss()}
            

            #notification-wrapper {
                margin-top: 2rem;
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
                <div id="btn-container" class="${classMap({hidden: this.isActivated || this.isRefresh})}">
                    <dbp-textswitch id="text-switch" name1="qr-reader"
                        name2="manual"
                        name="${i18n.t('check-in.qr-button-text')} || Manueller File Upload"
                        class="switch"
                        value1="${i18n.t('check-in.qr-button-text')}"
                        value2="Manueller File Upload"
                        @change=${ (e) => this.uploadSwitch(e.target.name) }></dbp-textswitch>
                </div>
                
                <div class="grid-container border ${classMap({hidden: !this.isActivated})}">
                    <div class="checkins">
                        <span class="header"><strong>Grüner Pass ist aktiv.</strong></span>
                        
                        <div><div class="btn"><dbp-loading-button ?disabled="${this.loading}" value="Grünen Pass löschen" @click="${(event) => { this.deleteGreenPass(event); }}" title="${i18n.t('check-out.button-text')}"></dbp-loading-button></div></div>
                        <div><div class="btn"><dbp-loading-button type="is-primary" id="refresh-btn" ?disabled="${this.loading}" value="Aktualisieren" @click="${(event) => { this.refreshGreenPass(event); }}" title="${i18n.t('check-in.refresh-button-text')}"></dbp-loading-button></div></div>
                    </div>
                    <div id="notification-wrapper" class="${classMap({hidden: !this.isActivated})}">
                        <dbp-inline-notification type="success" body="Ihr Grüner Pass ist noch gültig bis ${this.getReadableActivationDate(this.activationEndTime)}."></dbp-inline-notification>
                        <p>oder:</p>
                        <dbp-inline-notification type="warning" body="Ihr Grüner Pass läuft in Kürze ab!"></dbp-inline-notification>
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
                
                
                <div id="manualPassUploadWrapper" class="hidden">
                    <p>TODO: open file picker</p>
                    <button id="add-files-button" @click="${() => { this.openFileSource(); }}"
                            class="button" title="TODO add title">
                        Datei hochladen
                    </button>
                     <dbp-file-source
                                id="file-source"
                                context="TODO Kontext"
                                nextcloud-auth-url="${this.nextcloudWebAppPasswordURL}"
                                nextcloud-web-dav-url="${this.nextcloudWebDavURL}"
                                nextcloud-name="${this.nextcloudName}"
                                nextcloud-file-url="${this.nextcloudFileURL}"
                                nexcloud-auth-info="${this.nextcloudAuthInfo}"
                                enabled-targets="${this.fileHandlingEnabledTargets}"
                                decompress-zip
                                lang="${this.lang}"
                                text="Upload area text"
                                button-label="Datei auswählen"
                                number-of-files="1"
                                @dbp-file-source-file-selected="${this.getFilesToActivate}"
                    ></dbp-file-source>
                    <div class="${classMap({hidden: !this.QRCodeFile})}">
                        ${this.getFileData()}
                        <dbp-loading-button id="activate-btn" type="is-primary" class="button" @click="${(event) => { this.doPassUpload(event); }}" value="Aktivieren"></dbp-loading-button>
                    </div>

                </div>
                
                <div class="border ${classMap({hidden: !(this.showQrContainer || this.showManuallyContainer)})}">
                    <div class="element ${classMap({hidden: (this.isActivated && !this.showQrContainer) || this.showManuallyContainer || this.loading})}">
                        <dbp-qr-code-scanner id="qr-scanner" lang="${this.lang}" stop-scan match-regex="${matchRegexString}" @scan-started="${this._onScanStarted}" @code-detected="${(event) => { this.doActivationWithQR(event);}}"></dbp-qr-code-scanner>
                    </div>
                    <div class="element ${classMap({hidden: (this.isActivated && !this.showManuallyContainer) || this.showQrContainer || this.loading })}">
                
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
