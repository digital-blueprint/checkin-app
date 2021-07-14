import {ScopedElementsMixin} from '@open-wc/scoped-elements';
import {css, html} from 'lit-element';
import * as commonUtils from '@dbp-toolkit/common/utils';
import {Button, Icon, MiniSpinner} from "@dbp-toolkit/common";
import {TextSwitch} from "./textswitch";
import {createInstance} from "./i18n";
import * as commonStyles from "@dbp-toolkit/common/styles";
import {classMap} from "lit-html/directives/class-map";
import DBPCheckInLitElement from "./dbp-check-in-lit-element";
import * as CheckinStyles from './styles';

class CheckInInfo extends ScopedElementsMixin(DBPCheckInLitElement) {
    constructor() {
        super();
        this._i18n = createInstance();
        this.lang = this._i18n.language;
        this.entryPointUrl = '';
    }

    static get scopedElements() {
        return {
            'dbp-icon': Icon,
            'dbp-mini-spinner': MiniSpinner,
            'dbp-button': Button,
            'dbp-textswitch': TextSwitch,
        };
    }

    static get properties() {
        return {
            ...super.properties,
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
                    this._i18n.changeLanguage(this.lang);
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
            ${CheckinStyles.getCheckinCss()}
            
            .loading {
                justify-content: center;
            }
            
        `;
    }


    render() {
        const i18n = this._i18n;
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
                <h2>${i18n.t('info.title')}</h2>
                <p class="">${i18n.t('info.description')}</p>
                <div class="border">
                        <div class="container">  
                                    TODO
                        </div>
                </div>
            </div>
        `;
    }
}

commonUtils.defineCustomElement('dbp-check-in-info', CheckInInfo);