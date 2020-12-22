import { Auth } from "../../models/types/user";

export interface IResponseBodyUserInfo {
    id: string;
    username?: string;
    email: string;
    firstname?: string;
    lastname?: string;
    fullname?: string;
    avatar?: string;
    authMethod: Auth[];
}

