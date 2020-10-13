import DBPLitElement from 'dbp-common/dbp-lit-element';
import {ScopedElementsMixin} from '@open-wc/scoped-elements';
import {html} from 'lit-element';
import * as commonUtils from 'dbp-common/utils';

class GuestCheckIn extends ScopedElementsMixin(DBPLitElement) {
    render() {
        return html`TODO`;
    }
}

commonUtils.defineCustomElement('dbp-guest-check-in', GuestCheckIn);