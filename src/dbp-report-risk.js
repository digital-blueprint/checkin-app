import {ScopedElementsMixin} from '@open-wc/scoped-elements';
import {css, html} from 'lit-element';
import * as commonUtils from '@dbp-toolkit/common/utils';
import {Icon, MiniSpinner} from "@dbp-toolkit/common";
import {createI18nInstance} from "./i18n";
import * as commonStyles from "@dbp-toolkit/common/styles";
import {classMap} from "lit-html/directives/class-map";
import DBPCheckInLitElement from "./dbp-check-in-lit-element";

const i18n = createI18nInstance();

class ReportRisk extends ScopedElementsMixin(DBPCheckInLitElement) {
    constructor() {
        super();
        this.lang = i18n.language;
    }

    static get scopedElements() {
        return {
            'dbp-icon': Icon,
            'dbp-mini-spinner': MiniSpinner,
        };
    }

    static get properties() {
        return {
            ...super.properties,
            lang: { type: String },
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
            }
        `;
    }


    render() {
        return html`
            <div class="control ${classMap({hidden: this.isLoggedIn() || !this.isLoading()})}">
                <span class="loading">
                    <dbp-mini-spinner text=${i18n.t('check-out.loading-message')}></dbp-mini-spinner>
                </span>
            </div>

            <div class="notification is-warning ${classMap({hidden: this.isLoggedIn() || this.isLoading()})}">
                    ${i18n.t('error-login-message')}
            </div>

            <div class="${classMap({hidden: !this.isLoggedIn() || this.isLoading()})}">
                <vpu-notification lang="de" client-id="my-client-id"></vpu-notification>
                <h2>${i18n.t('report-risk.title')}</h2>
                <p class="">${i18n.t('report-risk.description')}</p>
                <slot name="extra-description">
                    <p>
                        ${i18n.t('report-risk.text')}
                    </p>
                </slot>
            </div>
        `;
    }
}

commonUtils.defineCustomElement('dbp-report-risk', ReportRisk);