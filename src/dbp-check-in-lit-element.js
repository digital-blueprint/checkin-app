import {LitElement} from "lit-element";
import {EventBus} from 'dbp-common';
import DBPLitElement from 'dbp-common/dbp-lit-element';

export default class DBPCheckInLitElement extends DBPLitElement {
    constructor() {
        super();
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
}