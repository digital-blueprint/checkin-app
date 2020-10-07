import {createI18nInstance} from './i18n.js';
import {css, html} from 'lit-element';
import DBPLitElement from 'dbp-common/dbp-lit-element';
import {ScopedElementsMixin} from '@open-wc/scoped-elements';
import * as commonUtils from 'dbp-common/utils';
import {Button, Icon, MiniSpinner} from 'dbp-common';
import {classMap} from 'lit-html/directives/class-map.js';
import * as commonStyles from 'dbp-common/styles';
import {TextSwitch} from './textswitch.js';
import {QrCodeScanner} from 'dbp-qr-code-scanner';

const i18n = createI18nInstance();

class CheckIn extends ScopedElementsMixin(DBPLitElement) {
    constructor() {
        super();
        this.lang = i18n.language;
        this.entryPointUrl = commonUtils.getAPiUrl();
        this.locationHash = '';
        this.seatNr = '';
        this.isCheckedIn = false;
        this.identifier = '';
        this.agent = '';
        this.showQrContainer = false;
        this.showManuallyContainer = false;
        this.showBorder = false;
    }

    static get scopedElements() {
        return {
          'dbp-icon': Icon,
          'dbp-mini-spinner': MiniSpinner,
          'dbp-button': Button,
          'dbp-textswitch': TextSwitch,
          'dbp-qr-code-scanner': QrCodeScanner,
        };
    }

    static get properties() {
        return {
            lang: { type: String },
            entryPointUrl: { type: String, attribute: 'entry-point-url' },
            locationHash: { type: String, attribute: false },
            seatNr: { type: String, attribute: false },
            isCheckedIn: { type: Boolean, attribute: false},
            showQrContainer: { type: Boolean, attribute: false},
            showManuallyContainer: { type: Boolean, attribute: false},
            showBorder: { type: Boolean, attribute: false},
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
            super.update(changedProperties);
            // console.log(propName, oldValue);
        });
    }

    async httpGetAsync(url, options)
    {
        let response = await fetch(url, options).then(result => {
            if (!result.ok) throw result;
            return result.json();
        }).catch(error => {
            console.log("fetch error:", error);
        });

        return response;
    }

    async doCheckOut() {
        let responseData = await this.sendCheckOutRequest();

        return responseData;
    }
    
    async doCheckIn(event) {
        let url = event.detail;
        event.stopPropagation(); //TODO await?
        this._("#qr-scanner").stopScan = true; //TODO error handling

        this.showManuallyContainer = false;
        this.showQrContainer = false;
        this.showBorder = false;

        if (!this.isCheckedIn) {
            this.decodeUrl(url);
            console.log('loc: ', this.locationHash, ', seat: ', this.seatNr);

            if (this.locationHash.length > 0) {
                let responseData = await this.sendCheckInRequest(); //TODO error handling
                try {
                    this.identifier = responseData['identifier'];
                    this.agent = responseData['agent'];
                } catch(exception) {
                    console.log("error: returned data cannot be parsed");
                }
            } else {
                console.log('error: location hash is empty');
            }
        }
    }

    decodeUrl(url) {
        console.log(url);
        let params = new URLSearchParams(url);
        let locationParam = params.get('l');
        let splitted = locationParam.split('-');
        if (splitted.length > 1) {
            this.locationHash = splitted[0];
            this.seatNr = splitted[1]; //TODO check if valid number?
        } else {
            console.log('error: parsing went wrong');
        }
    }

    async sendCheckInRequest() {
        let response;

        let body = {
            "location": '/check_in_places/' + this.locationHash,
            "seatNumber": this.seatNr,
        };

        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/ld+json',
                Authorization: "Bearer " + window.DBPAuthToken
            },
            body: JSON.stringify(body)
        };

        this.isCheckedIn = true;

        response = await this.httpGetAsync(this.entryPointUrl + '/location_check_in_actions', options);     

        console.log('response: ', response);

        return response;
    }

    async sendCheckOutRequest() {
        let response;

        let body = {
            "identifier": this.identifier,
            "agent": this.agent,
            "location": this.locationHash,
        };

        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/ld+json',
                Authorization: "Bearer " + window.DBPAuthToken
            },
            body: JSON.stringify(body)
        };

        this.isCheckedIn = false;

        response = await this.httpGetAsync(this.entryPointUrl + '/location_check_out_actions', options);

        console.log('response: ', response);

        return response;
    }

    showQrReader() {
        this.showBorder = true;
        this.showQrContainer = true;
        this.showManuallyContainer = false;
    }

    showRoomSelector() {
        this.showBorder = true;
        this.showQrContainer = false;
        this.showManuallyContainer = true;
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
            }
        `;
    }

    render() {
        return html`
            <h2>${i18n.t('check-in.title')}</h2>
            
            <p class="${classMap({hidden: !this.isCheckedIn})}">${i18n.t('check-in.checked-in-description')}</p>
            <div>
                <button class="button is-primary ${classMap({hidden: !this.isCheckedIn})}" @click="${this.doCheckOut}">${i18n.t('check-out.button-text')}</button>
            </div>

            <p class="${classMap({hidden: this.isCheckedIn})}">${i18n.t('check-in.description')}</p>
            <div id="btn-container" class="${classMap({hidden: this.isCheckedIn})}">
                <div class="btn"><button class="button ${classMap({'is-primary': !this.showManuallyContainer})}" @click="${this.showQrReader}">${i18n.t('check-in.qr-button-text')}</button></div>
                <div class="btn"><button class="button ${classMap({'is-primary': this.showManuallyContainer})}" @click="${this.showRoomSelector}">${i18n.t('check-in.manually-button-text')}</button></div>
            </div>
            <div class="border ${classMap({hidden: !this.showBorder})}">
                ${!this.isCheckedIn && this.showQrContainer ? html`<div class="element"><dbp-qr-code-scanner id="qr-scanner" lang="${this.lang}" @dbp-qr-code-scanner-data="${(event) => { this.doCheckIn(event);}}"></dbp-qr-code-scanner></div>` : ``}
                ${!this.isCheckedIn && this.showManuallyContainer ? html`<div class="element">TODO</div>` : ``}
            </div>
        `;
    }
}

commonUtils.defineCustomElement('dbp-check-in-request', CheckIn);
