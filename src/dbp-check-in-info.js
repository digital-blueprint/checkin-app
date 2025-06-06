import {ScopedElementsMixin} from '@dbp-toolkit/common';
import {css, html} from 'lit-element';
import * as commonUtils from '@dbp-toolkit/common/utils';
import {Button, Icon, MiniSpinner} from '@dbp-toolkit/common';
import {TextSwitch} from './textswitch';
import {createInstance} from './i18n';
import * as commonStyles from '@dbp-toolkit/common/styles';
import {classMap} from 'lit/directives/class-map.js';
import DBPCheckInLitElement from './dbp-check-in-lit-element';
import * as CheckinStyles from './styles';
import {Activity} from './activity.js';
import metadata from './dbp-check-in-info.metadata.json';
import {LoginStatus} from '@dbp-toolkit/auth/src/util.js';

class CheckInInfo extends ScopedElementsMixin(DBPCheckInLitElement) {
    constructor() {
        super();
        this._i18n = createInstance();
        this.lang = this._i18n.language;
        this.activity = new Activity(metadata);
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
            lang: {type: String},
            entryPointUrl: {type: String, attribute: 'entry-point-url'},
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

    _onLoginClicked(e) {
        this.sendSetPropertyEvent('requested-login-status', LoginStatus.LOGGED_IN);
        e.preventDefault();
    }

    static get styles() {
        // language=css
        return css`
            ${commonStyles.getThemeCSS()}
            ${commonStyles.getGeneralCSS(false)}
            ${commonStyles.getButtonCSS()}
            ${commonStyles.getNotificationCSS()}
            ${commonStyles.getActivityCSS()}
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
                    <dbp-mini-spinner
                        text=${i18n.t('check-out.loading-message')}></dbp-mini-spinner>
                </span>
            </div>

            <div
                class="notification is-warning ${classMap({
                    hidden: this.isLoggedIn() || this.isLoading(),
                })}">
                ${i18n.t('error-login-message')}
                <a href="#" @click="${this._onLoginClicked}">${i18n.t('error-login-link')}</a>
            </div>

            <div class="${classMap({hidden: !this.isLoggedIn() || this.isLoading()})}">
                <h2>${this.activity.getName(this.lang)}</h2>
                <p class="subheadline">
                    <slot name="description">${this.activity.getDescription(this.lang)}</slot>
                </p>
                <div class="border">
                    <div class="container">TODO</div>
                </div>
            </div>
        `;
    }
}

commonUtils.defineCustomElement('dbp-check-in-info', CheckInInfo);
