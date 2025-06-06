import {createInstance} from './i18n.js';
import {css, html} from 'lit';
import DBPCheckInLitElement from './dbp-check-in-lit-element';
import {classMap} from 'lit/directives/class-map.js';
import {ScopedElementsMixin} from '@dbp-toolkit/common';
import * as commonUtils from '@dbp-toolkit/common/utils';
import {Icon, LoadingButton, MiniSpinner} from '@dbp-toolkit/common';
import * as commonStyles from '@dbp-toolkit/common/styles';
import {TextSwitch} from './textswitch.js';
import {send} from '@dbp-toolkit/common/notification';
import * as CheckinStyles from './styles';
import {Activity} from './activity.js';
import metadata from './dbp-check-out-request.metadata.json';
import {LoginStatus} from '@dbp-toolkit/auth/src/util.js';

class CheckOut extends ScopedElementsMixin(DBPCheckInLitElement) {
    constructor() {
        super();
        this._i18n = createInstance();
        this.lang = this._i18n.language;
        this.activity = new Activity(metadata);
        this.entryPointUrl = '';
        this.activeCheckins = [];
        this.loading = false;
        this._initialFetchDone = false;
    }

    static get scopedElements() {
        return {
            'dbp-icon': Icon,
            'dbp-mini-spinner': MiniSpinner,
            'dbp-loading-button': LoadingButton,
            'dbp-textswitch': TextSwitch,
        };
    }

    static get properties() {
        return {
            ...super.properties,
            lang: {type: String},
            entryPointUrl: {type: String, attribute: 'entry-point-url'},
            activeCheckins: {type: Array, attribute: false},
            initialCheckinsLoading: {type: Boolean, attribute: false},
            loading: {type: Boolean, attribute: false},
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

            // console.log(propName, oldValue);
        });

        super.update(changedProperties);
    }

    /**
     * Init a checkout request at a specific location and send notification if it worked or not
     *
     * @param event
     * @param entry
     */
    async doCheckOut(event, entry) {
        let locationHash = '';
        let seatNr = '';
        let locationName = '';
        let button = event.target;
        const i18n = this._i18n;

        if (entry !== undefined) {
            locationHash = entry['location'] ? entry['location']['identifier'] : '';
            seatNr = entry['seatNumber'];
            locationName = entry['location'] ? entry['location']['name'] : '';
        }

        if (locationHash.length === 0) {
            send({
                summary: i18n.t('check-out.checkout-failed-title'),
                body: i18n.t('check-out.checkout-failed-body', {room: locationName}),
                type: 'warning',
                timeout: 5,
            });
            await this.sendErrorAnalyticsEvent(
                'CheckOutRequest',
                'CheckOutFailed',
                this.checkedInRoom,
            );
        } else {
            let response;
            this.loading = true;
            button.start();

            try {
                response = await this.sendCheckOutRequest(locationHash, seatNr);
                await this.getListOfActiveCheckins();
            } finally {
                button.stop();
                this.loading = false;
            }

            await this.checkCheckoutResponse(
                response,
                locationHash,
                seatNr,
                locationName,
                'CheckOutRequest',
            );
        }
    }

    /**
     * Parses the active checkins response
     *
     * @param response
     * @returns {Array} list
     */
    parseActiveCheckins(response) {
        let list = Array.from(response['hydra:member']);
        list.sort(this.compareListItems);

        return list;
    }

    compareListItems(a, b) {
        if (a.location.name < b.location.name) {
            return -1;
        } else if (a.location.name > b.location.name) {
            return 1;
        } else {
            if (a.seatNumber < b.seatNumber) {
                return -1;
            } else if (a.seatNumber > b.seatNumber) {
                return 1;
            } else {
                return 0;
            }
        }
    }

    /**
     * Get a list of active checkins
     *
     * @returns {Array} list
     */
    async getListOfActiveCheckins() {
        this.initialCheckinsLoading = !this._initialFetchDone;
        try {
            let response = await this.getActiveCheckIns();
            let responseBody = await response.json();
            if (responseBody !== undefined && responseBody.status !== 403) {
                this.activeCheckins = this.parseActiveCheckins(responseBody);
            }
        } finally {
            this.initialCheckinsLoading = false;
            this._initialFetchDone = true;
        }
    }

    /**
     * Init a session refresh
     *
     * @param event
     * @param entry
     */
    async doRefreshSession(event, entry) {
        let locationHash = entry['location']['identifier'];
        let seatNr = entry['seatNumber'];
        let locationName = entry['location']['name'];
        let button = event.target;
        button.start();
        this.loading = true;
        try {
            await this.refreshSession(locationHash, seatNr, locationName, 'CheckOutRequest');
            await this.getListOfActiveCheckins();
        } finally {
            button.stop();
            this.loading = false;
        }
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

            .checkins {
                display: grid;
                grid-template-columns: repeat(3, max-content);
                column-gap: 15px;
                row-gap: 1.5em;
                align-items: center;
                margin-top: 2em;
            }

            .header {
                display: grid;
                align-items: center;
            }

            .border {
                margin-top: 2rem;
                padding-top: 2rem;
                border-top: var(--dbp-border);
            }

            @media only screen and (orientation: portrait) and (max-width: 768px) {
                .checkins {
                    display: block;
                }

                .header {
                    margin-bottom: 0.5rem;
                }

                #refresh-btn {
                    margin-top: 0.5rem;
                    margin-bottom: 2rem;
                }

                .btn {
                    display: flex;
                    flex-direction: column;
                }

                .loading {
                    justify-content: center;
                }
            }
        `;
    }

    render() {
        const i18n = this._i18n;

        if (
            this.isLoggedIn() &&
            !this.isLoading() &&
            !this._initialFetchDone &&
            !this.initialCheckinsLoading
        ) {
            this.getListOfActiveCheckins();
        }

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
                <p class="subheadline">
                    <slot name="description">${this.activity.getDescription(this.lang)}</slot>
                </p>

                <div
                    class="border checkins ${classMap({
                        hidden: !this.isLoggedIn() || this.isLoading(),
                    })}">
                    ${this.activeCheckins.map(
                        (i) => html`
                            <span class="header">
                                <strong>${i.location.name}</strong>
                                ${i.seatNumber !== null
                                    ? html`
                                          ${i18n.t('check-in.seatNr')}: ${i.seatNumber}
                                          <br />
                                      `
                                    : ``}
                                ${i18n.t('check-out.checkin-until')}
                                ${this.getReadableDate(i.endTime)}
                            </span>

                            <div>
                                <div class="btn">
                                    <dbp-loading-button
                                        type="is-primary"
                                        ?disabled="${this.loading}"
                                        value="${i18n.t('check-out.button-text')}"
                                        @click="${(event) => {
                                            this.doCheckOut(event, i);
                                        }}"
                                        title="${i18n.t(
                                            'check-out.button-text',
                                        )}"></dbp-loading-button>
                                </div>
                            </div>
                            <div>
                                <div class="btn">
                                    <dbp-loading-button
                                        id="refresh-btn"
                                        ?disabled="${this.loading}"
                                        value="${i18n.t('check-in.refresh-button-text')}"
                                        @click="${(event) => {
                                            this.doRefreshSession(event, i);
                                        }}"
                                        title="${i18n.t(
                                            'check-in.refresh-button-text',
                                        )}"></dbp-loading-button>
                                </div>
                            </div>
                        `,
                    )}
                    <span
                        class="control ${classMap({
                            hidden: this.isLoggedIn() && !this.initialCheckinsLoading,
                        })}">
                        <span class="loading">
                            <dbp-mini-spinner
                                text=${i18n.t('check-out.loading-message')}></dbp-mini-spinner>
                        </span>
                    </span>

                    <div
                        class="no-checkins ${classMap({
                            hidden:
                                !this.isLoggedIn() ||
                                this.initialCheckinsLoading ||
                                this.activeCheckins.length !== 0,
                        })}">
                        ${i18n.t('check-out.no-checkins-message')}
                    </div>
                </div>
            </div>
        `;
    }
}

commonUtils.defineCustomElement('dbp-check-out-request', CheckOut);
