import {ScopedElementsMixin} from '@open-wc/scoped-elements';
import {css, html} from 'lit';
import * as commonUtils from '@dbp-toolkit/common/utils';
import {Icon, MiniSpinner} from '@dbp-toolkit/common';
import {createInstance} from './i18n';
import * as commonStyles from '@dbp-toolkit/common/styles';
import {classMap} from 'lit/directives/class-map.js';
import DBPCheckInLitElement from './dbp-check-in-lit-element';
import * as CheckinStyles from './styles';
import {Activity} from './activity.js';
import metadata from './dbp-report-risk.metadata.json';

class ReportRisk extends ScopedElementsMixin(DBPCheckInLitElement) {
    constructor() {
        super();
        this._i18n = createInstance();
        this.lang = this._i18n.language;
        this.activity = new Activity(metadata);
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
            lang: {type: String},
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
            </div>

            <div class="${classMap({hidden: !this.isLoggedIn() || this.isLoading()})}">
                <h2>${this.activity.getName(this.lang)}</h2>
                <p class="subheadline">
                    <slot name="description">${this.activity.getDescription(this.lang)}</slot>
                </p>
                <slot name="additional-information">
                    <p>${i18n.t('report-risk.text')}</p>
                </slot>
            </div>
        `;
    }
}

commonUtils.defineCustomElement('dbp-report-risk', ReportRisk);
