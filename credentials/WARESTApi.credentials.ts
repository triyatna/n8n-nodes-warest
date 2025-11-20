import type {
  IAuthenticateGeneric,
  ICredentialTestRequest,
  ICredentialType,
  INodeProperties,
} from "n8n-workflow";

export class WARESTApi implements ICredentialType {
  name = "warestApi";
  displayName = "WAREST API";
  documentationUrl = "https://github.com/triyatna/warest-whatsapp-rest-api";

  properties: INodeProperties[] = [
    {
      displayName: "Base URL",
      name: "baseUrl",
      type: "string",
      default: "http://localhost:4001",
      placeholder: "https://warest.example.com",
      description:
        "Root URL of your WARest deployment including the protocol (http or https). E.g., https://warest.example.com",
      required: true,
    },
    {
      displayName: "API Key",
      name: "apiKey",
      type: "string",
      typeOptions: {
        password: true,
      },
      default: "",
      description: "API key created in the WARest.",
      required: true,
    },
  ];

  authenticate: IAuthenticateGeneric = {
    type: "generic",
    properties: {
      headers: {
        "X-WAREST-API-KEY": "={{$credentials.apiKey}}",
        Authorization: "=Bearer {{$credentials.apiKey}}",
      },
    },
  };

  test: ICredentialTestRequest = {
    request: {
      baseURL: "={{$credentials.baseUrl}}",
      url: "/api/v1/server/info",
    },
  };
}
