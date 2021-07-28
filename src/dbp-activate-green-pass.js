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
import {name as pkgName} from './../package.json';
import pdfjs from 'pdfjs-dist/legacy/build/pdf.js';


class QrScanner {
    constructor() {
        this._engine = null;
        this._canvas = document.createElement("canvas");
        this._scanner = null;
    }

    async scanImage(image) {
        if (this._scanner === null)  {
            this._scanner = (await import('qr-scanner')).default;
            this._scanner.WORKER_PATH = commonUtils.getAssetURL(pkgName, 'qr-scanner-worker.min.js');
        }
        if (this._engine === null) {
            this._engine = await this._scanner.createQrEngine(this._scanner.WORKER_PATH);
        }
        try {
            console.log("image", image);
            await this._scanner.scanImage(image)
                .then(result => console.log("QR found", result))
                .catch(error => console.log("Error", error || 'No QR code found.'));
            return {data: await this._scanner.scanImage(image)};
        } catch (e) {
            return null;
        }
    }
}

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
        pdfjs.GlobalWorkerOptions.workerSrc = commonUtils.getAssetURL(pkgName, 'pdfjs/pdf.worker.js');
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
     * Returns the content of the file
     *
     * @param {File} file The file to read
     * @returns {string} The content
     */
    readBinaryFileContent = async (file) => {
        return new Promise((resolve, reject) => {
            let reader = new FileReader();
            reader.onload = () => {
                resolve(reader.result);
            };
            reader.onerror = () => {
                reject(reader.error);
            };
            reader.readAsBinaryString(file);
        });
    };

    async getImageFromPDF()
    {
        const data = await this.readBinaryFileContent(this.QRCodeFile);
        let pages = [], heights = [], width = 0, height = 0, currentPage = 1;
        let scale = 1.5;
        let canvasImages = [];
        try {
            let pdf = await pdfjs.getDocument({data: data}).promise;
            await getPage(pdf);
        }
        catch (error) {
            console.error(error);
            return;
        }

        async function getPage(pdf) {
            pdf.getPage(currentPage).then(page => {
                let viewport = page.getViewport({scale});
                let canvas = document.createElement('canvas') , ctx = canvas.getContext('2d');
                let renderContext = { canvasContext: ctx, viewport: viewport };
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                page.render(renderContext).promise.then(response => {
                    console.log("page rendered");
                    pages.push(ctx.getImageData(0, 0, canvas.width, canvas.height));

                    heights.push(height);
                    height += canvas.height;
                    if (width < canvas.width) width = canvas.width;

                    if (currentPage < pdf.numPages) {
                        currentPage++;
                        getPage();
                    }
                    else {
                        let canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
                        canvas.width = width;
                        canvas.height = height;
                        for(let i = 0; i < pages.length; i++)
                            ctx.putImageData(pages[i], 0, heights[i]);
                        canvasImages.push(canvas);
                    }
                });
            });
        }
        return canvasImages;

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

    async tryDeleteActivation(greenPassHash) {
        let count_trys = 0;
        let responseData;
        while (count_trys !== 4) {

            let time = Math.pow(5, count_trys);
            responseData = 'response'; //await this.sendCheckOutRequest(greenPassHash); //TODO change to correct request
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
            //TODO: delete green pass data
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



    async searchQRInFile() {
        if (this.QRCodeFile.type === "application/pdf") {
            let ret = await this.getImageFromPDF();
            console.log("-----------", ret[0]);
            let payload = "";
            let scanner = new QrScanner();
            scanner.scanImage(ret[0]);
            //TODo MAKE await foreach
            console.log("yyaaaa", payload);

            return payload;
        } else {
            let payload = "";
            let scanner = new QrScanner();
            await scanner.scanImage(this.QRCodeFile);
            return payload;
        }

    }

    async doActivationManually(event) {
        let button = event.target;
        if (button.disabled) {
            return;
        }
        try {
            this.greenPassHash = await this.searchQRInFile();
            button.start();
            //await this.doActivation(this.greenPassHash, 'ActivationRequest', false, true);
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
                "summary": i18n.t('green-pass-activation.invalid-qr-code-title'),
                "body":  i18n.t('green-pass-activation.invalid-qr-code-body'),
                "type": "danger",
                "timeout": 5,
            });
            return false;
        }

        this.greenPassHash = passData;
        console.log('no error, qr code data: ', passData);

        let gpAlreadySend = await this.wrongHash.includes(this.greenPassHash);
        if (gpAlreadySend) {
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
        const i18n = this._i18n;
        let newDate = new Date(date);
        let month = newDate.getMonth() + 1;
        return i18n.t('green-pass-activation.valid-until', {date: newDate.getDate() + "." + month + "." + newDate.getFullYear(), clock: newDate.getHours() + ":" + ("0" + newDate.getMinutes()).slice(-2) });
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
     * Parse the response of a green pass activation request
     * Include message for user when it worked or not
     * Saves invalid QR codes in array in this.wrongHash, so no multiple requests are send
     *
     * Possible paths: checkin, refresh session, invalid input, green pass hash wrong
     * no permissions, any other errors, green pass hash empty
     *
     * @param responseData
     * @param greenPassHash
     * @param category
     * @param refresh (default = false)
     * @param setAdditional (default = false)
     */
    async checkActivationResponse(responseData, greenPassHash, category, refresh = false, setAdditional = false) {
        const i18n = this._i18n;

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
                    "summary": i18n.t('green-pass-activation.success-activation-title'),
                    "body": i18n.t('green-pass-activation.success-activation-body'),
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
            
            .checkins-btn {
                display: grid;
                grid-template-columns: repeat(2, max-content);
                column-gap: 10px;
                row-gap: 10px;
            }
            
            .checkins {
                display: flex;
                justify-content: space-between;
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
                
                .checkins-btn {
                    display: flex;
                    flex-direction: column;
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
        let privacyURL = commonUtils.getAssetURL('dbp-check-in', 'datenschutzerklaerung-tu-graz-check-in.pdf'); //TODO change to greenpass pdf?
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
                
                <h2>${i18n.t('green-pass-activation.title')}</h2>
                <div>
                    <p class="">${i18n.t('green-pass-activation.description')}</p>
                    <slot name="additional-information">
                        <p>${i18n.t('green-pass-activation.additional-information')}</p>
                        <p> 
                            ${i18n.t('green-pass-activation.data-protection')} 
                            <a href="${privacyURL}" title="${i18n.t('green-pass-activation.data-protection-link')}" target="_blank" class="int-link-internal"> 
                                <span>${i18n.t('green-pass-activation.data-protection-link')} </span>
                            </a>
                        </p>
                    </slot>
                </div>
                <div id="btn-container" class="${classMap({hidden: this.isActivated || this.isRefresh})}">
                    <dbp-textswitch id="text-switch" name1="qr-reader"
                        name2="manual"
                        name="${i18n.t('green-pass-activation.qr-button-text')} || ${i18n.t('green-pass-activation.manually-button-text')}
                        class="switch"
                        value1="${i18n.t('green-pass-activation.qr-button-text')}"
                        value2="${i18n.t('green-pass-activation.manually-button-text')}"
                        @change=${ (e) => this.uploadSwitch(e.target.name) }></dbp-textswitch>
                </div>
                
                <div class="grid-container border ${classMap({hidden: !this.isActivated})}">
                    <div class="checkins">
                        <span class="header"><strong>${i18n.t('green-pass-activation.uploaded-success-message')}</strong></span>
                        <div class="checkins-btn">
                            <div class="btn"><dbp-loading-button id="refresh-btn" ?disabled="${this.loading}" value="${i18n.t('green-pass-activation.refresh-button-text')}" @click="${(event) => { this.refreshGreenPass(event); }}" title="${i18n.t('green-pass-activation.refresh-button-text')}"></dbp-loading-button></div>
                            <div class="btn"><dbp-loading-button ?disabled="${this.loading}" value="${i18n.t('green-pass-activation.delete-button-text')}" @click="${(event) => { this.deleteGreenPass(event); }}" title="${i18n.t('green-pass-activation.delete-button-text')}"></dbp-loading-button></div>
                        </div>
                    </div>
                    <div id="notification-wrapper" class="${classMap({hidden: !this.isActivated})}">
                        <dbp-inline-notification type="success" body="${i18n.t('green-pass-activation.inline-notification-text')} ${this.getReadableActivationDate(this.activationEndTime)}."></dbp-inline-notification>
                        <p>oder Variante 2 (wird kurz vor Ablauf angezeigt):</p>
                        <dbp-inline-notification type="warning" body="${i18n.t('green-pass-activation.inline-notification-warning')}"></dbp-inline-notification>
                    </div>
                    
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
                        <dbp-loading-button id="activate-btn" type="is-primary" class="button" @click="${(event) => { this.doActivationManually(event); }}" value="${i18n.t('green-pass-activation.activate-button-title')}" title="${i18n.t('green-pass-activation.activate-button-title')}">></dbp-loading-button>

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
                                <dbp-loading-button id="activate-btn" type="is-primary" class="button" value="${i18n.t('green-pass-activation.activate-button-title')}" @click="${(event) => { this.doPassUpload(event); }}" title="${i18n.t('green-pass-activation.activate-button-title')}"></dbp-loading-button>
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
