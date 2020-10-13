import DBPLitElement from 'dbp-common/dbp-lit-element';

export default class DBPCheckInLitElement extends DBPLitElement {
    constructor() {
        super();
        this.isSessionRefreshed = false;
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

    async sendCheckOutRequest(locationHash, seatNumber) {
        let response;

        let body = {
            "location": "/check_in_places/" + locationHash,
            "seatNumber": parseInt(seatNumber),
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

        return response;
    }

    async sendCheckInRequest(locationHash, seatNumber) {
        let response;

        let body = {
            "location": '/check_in_places/' + locationHash,
            "seatNumber": parseInt(seatNumber),
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




}