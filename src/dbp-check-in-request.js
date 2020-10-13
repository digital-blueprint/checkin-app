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
import {LocationSelect} from 'dbp-location-select';
import { send } from 'dbp-common/notification';
import select2CSSPath from 'select2/dist/css/select2.min.css';

const i18n = createI18nInstance();

class CheckIn extends ScopedElementsMixin(DBPLitElement) {
    constructor() {
        super();
        this.lang = i18n.language;
        this.entryPointUrl = commonUtils.getAPiUrl();
        this.locationHash = '';
        this.seatNr = '';
        this.isCheckedIn = false;
        this.checkedInRoom = '';
        this.checkedInSeat = null;
        this.checkedInStartTime = '';
        this.identifier = '';
        this.agent = '';
        this.showManuallyContainer = false;
        this.showQrContainer = false;
        this.showBorder = false;
        this.searchHashString = "tugrazcheckin: -";
        this.wrongHash = [];
        this.wrongQR = [];
        this.isRoomSelected = false;
        this.roomCapacity = 0;
        this.isManuallySet = false;
        this.refreshSession = false;
    }

    static get scopedElements() {
        return {
          'dbp-icon': Icon,
          'dbp-mini-spinner': MiniSpinner,
          'dbp-button': Button,
          'dbp-textswitch': TextSwitch,
          'dbp-qr-code-scanner': QrCodeScanner,
          'dbp-location-select': LocationSelect,
        };
    }

    static get properties() {
        return {
            lang: { type: String },
            entryPointUrl: { type: String, attribute: 'entry-point-url' },
            locationHash: { type: String, attribute: false },
            seatNr: { type: Number, attribute: false },
            isCheckedIn: { type: Boolean, attribute: false},
            showManuallyContainer: { type: Boolean, attribute: false},
            showQrContainer: { type: Boolean, attribute: false},
            showBorder: { type: Boolean, attribute: false},
            isRoomSelected: {type: Boolean, attribute: false},
            roomCapacity: {type: Number, attribute: false},
            isManuallySet: {type: Boolean, attribute: false},
            checkedInStartTime: {type: String, attribute: false}
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

    async httpGetAsync(url, options) {
        let response = await fetch(url, options).then(result => {
            if (!result.ok) throw result;
            return result;
        }).catch(error => {
            return error;
        });

        return response;
    }

    async doCheckOut() {
        let responseData = await this.sendCheckOutRequest();
        if (responseData.status === 201) {
            send({
                "summary": i18n.t('check-out.checkout-success-title'),
                "body":  i18n.t('check-out.checkout-success-body', {count: parseInt(this.seatNr), room: this.checkedInRoom}),
                "type": "success",
                "timeout": 5,
            });
            this.isCheckedIn = false;
            this.locationHash = "";
            this.seatNr = "";
            this.checkedInRoom = "";
            this.checkedInSeat = "";
            this.checkedInStartTime = "";
        } else {
            send({
                "summary": i18n.t('check-out.checkout-failed-title'),
                "body":  i18n.t('check-out.checkout-failed-body', {count: parseInt(this.seatNr), room: this.checkedInRoom}),
                "type": "warning",
                "timeout": 5,
            });
        }
        return responseData;
    }
    
    async doCheckInWithQR(event) {
        let data = event.detail;
        event.stopPropagation();

        let check = await this.decodeUrl(data);
        if (check) {
            await this.doCheckIn();
        }
    }
//TODO check if needed
        // let check = !this.isManuallySet ? await this.decodeUrl(data) : false;
        // if (this.isManuallySet || check) {


    async doCheckIn() {
        // TODO logout button should be 'fancier' + You are checked in at "ROOMXX" in frontend

        console.log('loc: ', this.locationHash, ', seat: ', this.seatNr);

        if (this.locationHash.length > 0) {
            let responseData = await this.sendCheckInRequest();
            // When you are checked in
            if (responseData.status === 201) {
                let responseBody = await responseData.json();
                this.checkedInRoom = responseBody.location.name;
                this.checkedInSeat = responseBody.seatNumber;
                this.checkedInStartTime = responseBody.startTime; //TODO make time readable
                this.identifier = responseBody['identifier'];
                this.agent = responseBody['agent'];
                this.stopQRReader();
                this.isCheckedIn = true;

                if (this.refreshSession) {
                    this.refreshSession = false;
                    send({
                        "summary": i18n.t('check-in.success-refresh-title', {room: this.checkedInRoom}),
                        "body": i18n.t('check-in.success-refresh-body', {room: this.checkedInRoom}),
                        "type": "success",
                        "timeout": 5,
                    });
                } else {
                    send({
                        "summary": i18n.t('check-in.success-checkin-title', {room: this.checkedInRoom}),
                        "body": i18n.t('check-in.success-checkin-body', {room: this.checkedInRoom}),
                        "type": "success",
                        "timeout": 5,
                    });
                }

            // Invalid Input
            } else if (responseData.status === 400) {
                send({
                    "summary": i18n.t('check-in.invalid-input-title'),
                    "body":  i18n.t('check-in.invalid-input-body'),
                    "type": "danger",
                    "timeout": 5,
                });
                console.log("error: Invalid Input.");
                //this.wrongHash.push(this.locationHash + '-' + this.seatNr);

                // Error if room not exists
            } else if (responseData.status === 404) {
                send({
                    "summary": i18n.t('check-in.hash-false-title'),
                    "body":  i18n.t('check-in.hash-false-body'),
                    "type": "danger",
                    "timeout": 5,
                });
                console.log("error: room doesn't exists.");
                this.wrongHash.push(this.locationHash + '-' + this.seatNr);

                // Other errors
            } else if (responseData.status === 424) {
                let errorBody = await responseData.json();
                let errorDescription = errorBody["hydra:description"];
                console.log("err: ", errorDescription);
                console.log("err: ", errorBody);

                // Error: invalid seat number
                if( errorDescription === 'seatNumber must not exceed maximumPhysicalAttendeeCapacity of location!' || errorDescription === 'seatNumber too low!') {
                    send({
                        "summary": i18n.t('check-in.invalid-seatnr-title'),
                        "body":  i18n.t('check-in.invalid-seatnr-body'),
                        "type": "danger",
                        "timeout": 5,
                    });
                    console.log("error: Invalid seat nr");
                    this.wrongHash.push(this.locationHash + '-' + this.seatNr);
                }

                // Error: no seat numbers
                else if( errorDescription === 'Location doesn\'t have any seats activated, you cannot set a seatNumber!') {
                    send({
                        "summary": i18n.t('check-in.no-seatnr-title'),
                        "body":  i18n.t('check-in.no-seatnr-body'),
                        "type": "danger",
                        "timeout": 5,
                    });
                    console.log("error: Room has no seat nr");
                    this.wrongHash.push(this.locationHash + '-' + this.seatNr);
                }

                // Error: you are already checked in here
                else if( errorDescription === 'There are already check-ins at the location with provided seat for the current user!' ) {

                    let getActiveCheckInsResponse = await this.getActiveCheckIns();
                    if ( getActiveCheckInsResponse.status === 200) {
                        let getActiveCheckInsBody = await getActiveCheckInsResponse.json();
                        let checkInsArray = getActiveCheckInsBody["hydra:member"];

                        let atActualRoomCheckIn = checkInsArray.filter(x => (x.location.identifier === this.locationHash && x.seatNumber === parseInt(this.seatNr)));

                        if (atActualRoomCheckIn.length === 1) {
                            this.checkedInRoom = atActualRoomCheckIn[0].location.name;
                            this.checkedInStartTime = atActualRoomCheckIn[0].startTime;
                            this.checkedInSeat = atActualRoomCheckIn[0].seatNumber;
                            this.stopQRReader();
                            this.isCheckedIn = true;
                        } else {
                            send({
                                "summary": i18n.t('check-in.error-title'),
                                "body": i18n.t('check-in.error-body'),
                                "type": "danger",
                                "timeout": 5,
                            });
                        }
                    }
                    else {
                        send({
                            "summary": i18n.t('check-in.error-title'),
                            "body": i18n.t('check-in.error-body'),
                            "type": "danger",
                            "timeout": 5,
                        });
                    }
                    this.identifier = responseData['identifier'];
                    this.agent = responseData['agent'];
                    this.stopQRReader();
                    this.isCheckedIn = true;
                    this.checkedInRoom = "HS P1 PHEG024C";
                    // TODO check checkin at this room, show timestamp, and roomnumber, give a checkout button


                    send({
                        "summary": i18n.t('check-in.already-checkin-title'),
                        "body":  i18n.t('check-in.already-checkin-body'),
                        "type": "success",
                        "timeout": 5,
                    });
                    console.log("error: Already checkin");
                }

                // Error if you don't have permissions
            } else if (responseData.status === 403) {
                send({
                    "summary": i18n.t('check-in.no-permission-title'),
                    "body":  i18n.t('check-in.no-permission-body'),
                    "type": "danger",
                    "timeout": 5,
                });
                this.wrongHash.push(this.locationHash + '-' + this.seatNr);

                // Error: something else doesn't work
            } else{
                send({
                    "summary": i18n.t('check-in.error-title'),
                    "body": i18n.t('check-in.error-body'),
                    "type": "danger",
                    "timeout": 5,
                });
            }

            // Error: no location hash detected
        } else {
            send({
                "summary": i18n.t('check-in.error-title'),
                "body": i18n.t('check-in.error-body'),
                "type": "danger",
                "timeout": 5,
            });
            console.log('error: location hash is empty');
        }

    }

    stopQRReader() {
        if (this._("#qr-scanner")) {
            this._("#qr-scanner").stopScan = true;
            this.showManuallyContainer = false;
            this.showQrContainer = false;
            this.showBorder = false;
        } else {
            console.log('error: qr scanner is not available. Is it already stopped?');
        }
    }

    async decodeUrl(data) {
        let index = data.search(this.searchHashString);
        if (index === -1) {
            if ( !this.wrongQR.includes(data) ) {
                this.wrongQR.push(data);
                send({
                    "summary": i18n.t('check-in.qr-false-title'),
                    "body":  i18n.t('check-in.qr-false-body'),
                    "type": "danger",
                    "timeout": 5,
                });
            }
            return false;
        }
        let locationParam = data.substring(index + this.searchHashString.length);
        let checkAlreadySend = await this.wrongHash.includes(locationParam);

        if (checkAlreadySend) {
            console.log("schon gesendet");
            return false;
        }
        let splitted = locationParam.split('-');
        if (splitted.length > 1) {
            if (splitted [0] === this.locationHash && splitted[1] === this.seatNr) {
                return false;
            } else {
                this.locationHash = splitted[0];
                this.seatNr = splitted[1];
                return true;
            }
        } else {
            console.log('error: no correct QR code');
            return false;
        }
    }

    async sendCheckInRequest() {
        let response;

        let body = {
            "location": '/check_in_places/' + this.locationHash,
            "seatNumber": parseInt(this.seatNr),
        };

        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/ld+json',
                Authorization: "Bearer " + window.DBPAuthToken
            },
            body: JSON.stringify(body)
        };

        response = await this.httpGetAsync(this.entryPointUrl + '/location_check_in_actions', options);
        // console.log('response: ', response);

        return response;
    }

    async sendCheckOutRequest() {
        let response;

        let body = {
            "location": "/check_in_places/" + this.locationHash,
            "seatNumber": parseInt(this.seatNr),
        };

        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/ld+json',
                Authorization: "Bearer " + window.DBPAuthToken
            },
            body: JSON.stringify(body)
        };

        response = await this.httpGetAsync(this.entryPointUrl + '/location_check_out_actions', options);

        //console.log('response: ', response);

        return response;
    }

    async getActiveCheckIns() {
        let response;

        const options = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/ld+json',
                Authorization: "Bearer " + window.DBPAuthToken
            },
        };

        response = await this.httpGetAsync(this.entryPointUrl + '/location_check_in_actions', options);

        return response;
    }

    async doRefreshSession() {
        let responseCheckout = await this.sendCheckOutRequest();
        if (responseCheckout.status === 201) {
            this.refreshSession = true;
           await this.doCheckIn();
           return;
        }

        send({
            "summary": i18n.t('check-in.refresh-failed-title'),
            "body":  i18n.t('check-in.refresh-failed-body', {room: this.checkedInRoom}),
            "type": "warning",
            "timeout": 5,
        });
        return;

    }

    showQrReader() {
        this.showBorder = true;
        this.showQrContainer = true;
        this.showManuallyContainer = false;
        this._('#qr-scanner').stopScan = false;
    }

    showRoomSelector() {
        this._("#qr-scanner").stopScan = true;
        this.showBorder = true;
        this.showManuallyContainer = true;
        this.showQrContainer = false;
    }

    showAvailablePlaces(event) {
        this.isRoomSelected = true;
        this.roomCapacity = event.detail.capacity;

        console.log('event detail: ', event.detail);
        // this.locationHash = event.detail.room; //TODO fix this
        let splitted = event.detail.value.split('/');
        splitted.length === 3 ? this.locationHash = splitted[2] : console.log('error: invalid location id'); //TODO fix above and delete this

        console.log('room capacity: ', this.roomCapacity);
        console.log('location hash: ', this.locationHash); //TODO check if id and location hash are the same values
    }

    setSeatNumber(event) {
        this.seatNr = event.data;
        console.log('seat num: ', this.seatNr);
        this.isManuallySet = true;
        console.log('isManuallySet: ', this.isManuallySet);
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
            
            #select-seat {
                margin-bottom: 0.75rem;
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
                .logout {
                    width: 100%;
                    box-sizing: border-box;
                }
            }
        `;
    }

    render() {
        const select2CSS = commonUtils.getAssetURL(select2CSSPath);
        return html`
            <link rel="stylesheet" href="${select2CSS}">
            <vpu-notification lang="de" client-id="my-client-id"></vpu-notification>
            <h2>${i18n.t('check-in.title')}</h2>
            
            

            <p class="">${i18n.t('check-in.description')}</p>
            
            <div class="grid-container border ${classMap({hidden: !this.isCheckedIn})}">
                <h2> ${this.checkedInRoom} </h2> 
                <p class="${classMap({hidden: !this.isCheckedIn})}">
                    ${this.checkedInSeat ? i18n.t('check-in.checked-in-with-seat-description', {time: this.checkedInStartTime, room: this.checkedInRoom, seat: this.checkedInSeat}) : i18n.t('check-in.checked-in-description', {time: this.checkedInStartTime, room: this.checkedInRoom}) }
                </p>
                <div>
                    <button class="logout button is-primary " @click="${this.doCheckOut}" title="${i18n.t('check-out.button-text')}">${i18n.t('check-out.button-text')}</button>
                    <button class="logout button" @click="${this.doRefreshSession}" title="${i18n.t('check-in.refresh-button-text')}">${i18n.t('check-in.refresh-button-text')}</button>
                </div>
            </div>
            
            <div id="btn-container" class="${classMap({hidden: this.isCheckedIn})}">
                <div class="btn"><button class="button ${classMap({'is-primary': !this.showManuallyContainer})}" @click="${this.showQrReader}" title="${i18n.t('check-in.qr-button-text')}">${i18n.t('check-in.qr-button-text')}</button></div>
                <div class="btn"><button class="button ${classMap({'is-primary': this.showManuallyContainer})}" @click="${this.showRoomSelector}" title="${i18n.t('check-in.manually-button-text')}">${i18n.t('check-in.manually-button-text')}</button></div>
            </div>
            
            
            <div class="border ${classMap({hidden: !this.showBorder})}">
                <div class="element ${classMap({hidden: !(!this.isCheckedIn && this.showQrContainer)})}">
                    <dbp-qr-code-scanner id="qr-scanner" lang="${this.lang}" stop-scan @dbp-qr-code-scanner-data="${(event) => { this.doCheckInWithQR(event);}}"></dbp-qr-code-scanner></div>
                <div class="element ${classMap({hidden: !(!this.isCheckedIn && this.showManuallyContainer)})}">
                
                    <div class="container">
                    <form>
                        <div class="field">
                            <label class="label">${i18n.t('check-in.manually-place')}</label>
                            <div class="control">
                                <dbp-location-select lang="${this.lang}" entry-point-url="${commonUtils.getAPiUrl()}" @change="${(event) => {this.showAvailablePlaces(event);}}"></dbp-location-select>
                            </div>
                        </div>
                        <div class="field ${classMap({hidden: !this.isRoomSelected})}">
                            <link rel="stylesheet" href="${select2CSS}">
                            <label class="label">${i18n.t('check-in.manually-seat')}</label>
                            <div class="control">
                                <input type="number" id="select-seat" name="seat-number" min="1" max="${this.roomCapacity}" pattern="[0-9]{1}" ?disabled=${!this.isRoomSelected} @input="${(event) => {this.setSeatNumber(event);}}"> <!-- //TODO Styling + correct number -->
                            </div>
                        </div>
                    </form>
                    <div class="btn"><button class="button is-primary" @click="${(event) => {this.doCheckIn(event);}}" title="${i18n.t('check-in.manually-checkin-button-text')}">${i18n.t('check-in.manually-checkin-button-text')}</button></div>
                </div>
                </div>  
           </div>
        `;
    }
}

commonUtils.defineCustomElement('dbp-check-in-request', CheckIn);
