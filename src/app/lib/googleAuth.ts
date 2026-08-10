import config from "../../config";
import { OAuth2Client } from "google-auth-library";

export const googleClient = new OAuth2Client({
        client_id: config.google_client_id
    })