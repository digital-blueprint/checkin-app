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
import DBPCheckInLitElement from "./dbp-check-in-lit-element";

const i18n = createI18nInstance();

class GuestCheckIn extends ScopedElementsMixin(DBPCheckInLitElement) {
    constructor() {
        super();
        this.lang = i18n.language;
        this.entryPointUrl = commonUtils.getAPiUrl();
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

    showAvailablePlaces(event) {
        //TODO
    }

    doCheckin(event) {
        //TODO
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
            }

            ::placeholder { 
                color: inherit;
                opacity: 1; 
            }
        `;
    }


    render() {
        const select2CSS = commonUtils.getAssetURL(select2CSSPath);
        return html`
            <div class="notification is-warning ${classMap({hidden: this.isLoggedIn() || this.isLoading()})}">
                ${i18n.t('error-login-message')}
                ${console.log(this.isLoggedIn())}
            </div>

            <span class="control ${classMap({hidden: this.isLoggedIn() || !this.isLoading()})}">
                <dbp-mini-spinner text=${i18n.t('check-out.loading-message')}></dbp-mini-spinner>
            </span>

            <div class="${classMap({hidden: !this.isLoggedIn() || this.isLoading()})}">

                <link rel="stylesheet" href="${select2CSS}">
                <vpu-notification lang="de" client-id="my-client-id"></vpu-notification>
                <h2>${i18n.t('guest-check-in.title')}</h2>

                <p class="">${i18n.t('guest-check-in.description')}</p>
                
                <div class="border">
  
                        <div class="container">
                            <form>
                                <div class="field">
                                    <label class="label">${i18n.t('guest-check-in.email')}</label>
                                    <div class="control">
                                        <input type="text" class="input" id="email-field" placeholder="mail@email.at" name="email">
                                    </div>
                                </div>
                                <div class="field">
                                    <label class="label">${i18n.t('check-in.manually-place')}</label>
                                    <div class="control">
                                        <dbp-location-select lang="${this.lang}" entry-point-url="${commonUtils.getAPiUrl()}" @change="${(event) => {this.showAvailablePlaces(event);}}"></dbp-location-select>
                                    </div>
                                </div>
                                <div class="field ${classMap({hidden: !this.isRoomSelected || this.roomCapacity === null})}">
                                    <link rel="stylesheet" href="${select2CSS}">
                                    <label class="label">${i18n.t('check-in.manually-seat')}</label>
                                    <div class="control">
                                        <input class="input" type="text" name="seat-number" min="1" max="${this.roomCapacity}" placeholder="1-${this.roomCapacity}" maxlength="4" inputmode="numeric" pattern="[0-9]*" ?disabled=${!this.isRoomSelected} @input="${(event) => {this.setSeatNumber(event);}}"> <!-- //TODO Styling of arrows -->
                                    </div>
                                </div>
                            </form>
                            <div class="btn">
                                <button id="do-manually-checkin" class="button is-primary" title="${i18n.t('check-in.manually-checkin-button-text')}">${i18n.t('check-in.manually-checkin-button-text')}</button>
                            </div>
                        </div>
                    
            </div>
           </div>
        `;
    }
}

commonUtils.defineCustomElement('dbp-guest-check-in', GuestCheckIn);