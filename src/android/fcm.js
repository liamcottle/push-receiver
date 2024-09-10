const crypto = require("crypto");
const { checkIn } = require("../gcm");
const { waitFor } = require("../utils/timeout");
const request = require("../utils/request");

class AndroidFCM {

    static async register(apiKey, projectId, gcmSenderId, gmsAppId, androidPackageName, androidPackageCert) {

        // create firebase installation
        const installationAuthToken = await this.installRequest(apiKey, projectId, gmsAppId, androidPackageName, androidPackageCert);

        // checkin gcm
        const checkInResponse = await checkIn();

        // register gcm
        const fcmToken = await this.registerRequest(checkInResponse.androidId, checkInResponse.securityToken, installationAuthToken, apiKey, gcmSenderId, gmsAppId, androidPackageName, androidPackageCert);

        return {
            gcm: {
                androidId: checkInResponse.androidId,
                securityToken: checkInResponse.securityToken,
            },
            fcm: {
                token: fcmToken,
            },
        };

    }

    static async installRequest(apiKey, projectId, gmsAppId, androidPackage, androidCert) {

        // send firebase installation request
        const response = await request({
            url: `https://firebaseinstallations.googleapis.com/v1/projects/${projectId}/installations`,
            method: 'POST',
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
                "X-Android-Package": androidPackage,
                "X-Android-Cert": androidCert,
                "x-firebase-client": "android-min-sdk/23 fire-core/20.0.0 device-name/a21snnxx device-brand/samsung device-model/a21s android-installer/com.android.vending fire-android/30 fire-installations/17.0.0 fire-fcm/22.0.0 android-platform/ kotlin/1.9.23 android-target-sdk/34",
                "x-firebase-client-log-type": "3",
                "x-goog-api-key": apiKey,
                "User-Agent": "Dalvik/2.1.0 (Linux; U; Android 11; SM-A217F Build/RP1A.200720.012)",
            },
            body: JSON.stringify({
                "fid": this.generateFirebaseFID(),
                "appId": gmsAppId,
                "authVersion": "FIS_v2",
                "sdkVersion": "a:17.0.0",
            }),
        });

        // ensure auth token received
        const data = JSON.parse(response);
        if(!data || !data.authToken || !data.authToken.token){
            throw new Error(`Failed to get Firebase installation AuthToken: ${data}`);
        }

        return data.authToken.token;

    }

    static async registerRequest(androidId, securityToken, installationAuthToken, apiKey, gcmSenderId, gmsAppId, androidPackageName, androidPackageCert, retry = 0) {

        // register gcm
        const response = await request({
            url: "https://android.clients.google.com/c2dm/register3",
            method: 'POST',
            headers: {
                "Authorization": `AidLogin ${androidId}:${securityToken}`,
                "Content-Type": "application/x-www-form-urlencoded",
            },
            form: {
                "device": androidId,
                "app": androidPackageName,
                "cert": androidPackageCert,
                "app_ver": "1",
                "X-subtype" : gcmSenderId,
                "X-app_ver" : "1",
                "X-osv" : "29",
                "X-cliv" : "fiid-21.1.1",
                "X-gmsv" : "220217001",
                // "X-appid" : "",
                "X-scope" : "*",
                "X-Goog-Firebase-Installations-Auth" : installationAuthToken,
                "X-gms_app_id" : gmsAppId,
                "X-Firebase-Client" : "android-min-sdk/23 fire-core/20.0.0 device-name/a21snnxx device-brand/samsung device-model/a21s android-installer/com.android.vending fire-android/30 fire-installations/17.0.0 fire-fcm/22.0.0 android-platform/ kotlin/1.9.23 android-target-sdk/34",
                // "X-firebase-app-name-hash" : "",
                "X-Firebase-Client-Log-Type": "1",
                "X-app_ver_name": "1",
                "target_ver": "31",
                "sender": gcmSenderId,
            },
        });

        // retry a few times if needed
        if(response.includes('Error')){
            console.warn(`Register request has failed with ${response}`);
            if(retry >= 5){
                throw new Error('GCM register has failed');
            }
            console.warn(`Retry... ${retry + 1}`);
            await waitFor(1000);
            return this.registerRequest(androidId, securityToken, installationAuthToken, apiKey, gcmSenderId, gmsAppId, androidPackageName, androidPackageCert, retry + 1);
        }

        // extract fcm token from response
        return response.split("=")[1];

    }

    /**
     * Generates a Firebase ID
     * https://github.com/firebase/firebase-js-sdk/blob/3670ab83c563dc96f2ad0120c551f46fe7d1bb7b/packages/installations/src/helpers/generate-fid.ts#L27
     * https://github.com/rixcian/firebase-electron/blob/master/src/core/fcm/index.ts#L124
     * @returns {string}
     */
    static generateFirebaseFID() {

        const buf = crypto.randomBytes(17);

        // replace the first 4 bits with the constant FID header of 0b0111
        buf[0] = 0b01110000 | (buf[0] & 0b00001111);

        // encode to base64 and remove padding
        return buf.toString("base64").replace(/=/g, "");

    }

}

module.exports = AndroidFCM;
