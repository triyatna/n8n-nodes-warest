import type {
  IDataObject,
  IExecuteFunctions,
  ILoadOptionsFunctions,
  INodeExecutionData,
  INodeListSearchResult,
  INodeProperties,
  INodePropertyOptions,
  INodeType,
  INodeTypeDescription,
} from "n8n-workflow";
import { NodeOperationError } from "n8n-workflow";

type Resource =
  | "server"
  | "session"
  | "messages"
  | "chats"
  | "messageAction"
  | "group"
  | "profile"
  | "misc";

interface OperationConfig {
  method: "GET" | "POST" | "DELETE";
  path: string;
  qsFields?: string[];
  bodyFields?: string[];
  pathParams?: string[];
  sendAdditionalTo?: "body" | "query";
  preprocess?: (
    this: IExecuteFunctions,
    body: IDataObject,
    qs: IDataObject,
    itemIndex: number
  ) => void;
}

const messageSendOperations = [
  "sendText",
  "sendFiles",
  "sendMedia",
  "sendDocument",
  "sendAudio",
  "sendGif",
  "sendSticker",
  "sendButton",
  "sendList",
  "sendLocation",
  "sendPoll",
  "sendContact",
] as const;

const chatOperations = [
  "listChats",
  "getChatMessages",
  "pinChat",
  "pinMessage",
  "markChatRead",
  "archiveChat",
  "unarchiveChat",
  "muteChat",
  "unmuteChat",
  "clearChat",
] as const;

const messageActionOperations = [
  "deleteMessage",
  "editMessage",
  "markMessageRead",
  "reactToMessage",
  "removeReaction",
  "revokeMessage",
  "starMessage",
  "unstarMessage",
] as const;

const groupOperations = [
  "listGroups",
  "getGroupInfo",
  "getGroupInvite",
  "revokeGroupInvite",
  "joinGroupByLink",
  "previewGroupByLink",
  "createGroup",
  "leaveGroup",
  "deleteGroup",
  "updateGroupName",
  "updateGroupDescription",
  "setGroupAnnouncement",
  "setGroupLocked",
  "getGroupParticipants",
  "addGroupParticipants",
  "removeGroupParticipants",
  "promoteGroupParticipants",
  "demoteGroupParticipants",
  "approveJoinRequest",
  "rejectJoinRequest",
  "listJoinRequests",
  "getGroupPicture",
  "setGroupPicture",
  "deleteGroupPicture",
] as const;

const profileOperations = [
  "getProfileInfo",
  "getProfilePicture",
  "setProfilePicture",
  "deleteProfilePicture",
  "getPrivacySettings",
  "listContacts",
  "checkOnWhatsapp",
  "getBusinessProfile",
] as const;

const miscOperations = [
  "convertStringToQr",
  "base64",
  "cryptoHash",
  "cryptoHmac",
  "thumbnail",
  "processImage",
  "uuidGenerate",
  "uuidValidate",
  "decryptWhatsappFile",
  "decryptPollVote",
  "validatePhone",
  "validateJid",
  "resolveJidOrLid",
] as const;

const ADDITIONAL_FIELD_NAME: Record<Resource, string> = {
  server: "serverAdditionalFields",
  session: "sessionAdditionalFields",
  messages: "messageAdditionalFields",
  chats: "chatAdditionalFields",
  messageAction: "messageActionAdditionalFields",
  group: "",
  profile: "profileAdditionalFields",
  misc: "miscAdditionalFields",
};

const MESSAGE_OPTION_FIELDS: Record<string, string[]> = {
  sendText: [],
  sendFiles: ["caption"],
  sendMedia: ["caption", "compress", "viewOnce"],
  sendDocument: ["caption", "filename", "compress"],
  sendAudio: ["isVN"],
  sendGif: ["caption", "compress"],
  sendSticker: ["caption", "compress"],
  sendButton: ["footer", "image"],
  sendList: ["footer", "image"],
  sendLocation: [],
  sendPoll: ["maxSelection"],
  sendContact: [],
};

const selectorProperties: INodeProperties[] = [
  {
    displayName: "Resource",
    name: "resource",
    type: "options",
    noDataExpression: true,
    options: [
      { name: "Server", value: "server" },
      { name: "Sessions", value: "session" },
      { name: "Messages - Sending", value: "messages" },
      { name: "Chats", value: "chats" },
      { name: "Messages - Actions", value: "messageAction" },
      { name: "Groups", value: "group" },
      { name: "Profile", value: "profile" },
      { name: "Miscellaneous", value: "misc" },
    ],
    default: "messages",
    description: "Choose the part of WARest you want to call",
  },
  {
    displayName: "Operation",
    name: "operation",
    type: "options",
    noDataExpression: true,
    displayOptions: { show: { resource: ["server"] } },
    options: [
      { name: "Ping", value: "ping", action: "Ping server" },
      { name: "Server Info", value: "info", action: "Fetch runtime info" },
      { name: "Health Check", value: "health", action: "Check /healthz" },
      { name: "Ready Check", value: "ready", action: "Check /ready" },
      { name: "CPU History", value: "cpuHistory", action: "Fetch CPU history" },
      {
        name: "Restart",
        value: "restart",
        action: "Schedule restart",
        description: "Restart the server immediately or after a short delay",
      },
      {
        name: "Schedule Daily Restart",
        value: "scheduleRestart",
        action: "Schedule daily restart",
      },
    ],
    default: "ping",
  },
  {
    displayName: "Operation",
    name: "operation",
    type: "options",
    noDataExpression: true,
    displayOptions: { show: { resource: ["session"] } },
    options: [
      {
        name: "Create Session",
        value: "createSession",
        action: "Create a session",
        description: "Boot a new WhatsApp session",
      },
      {
        name: "Create Pair Code",
        value: "createPairCode",
        action: "Create pair code",
        description: "Create a session using a pairing code",
      },
      {
        name: "Logout Session",
        value: "logout",
        action: "Logout session",
      },
      {
        name: "Reconnect Session",
        value: "reconnect",
        action: "Reconnect session",
      },
      {
        name: "List Devices",
        value: "devices",
        action: "List devices",
      },
      { name: "List Sessions", value: "listSessions", action: "List sessions" },
      {
        name: "Delete Session",
        value: "deleteSession",
        action: "Delete session",
      },
      {
        name: "Update Session Config",
        value: "updateConfig",
        action: "Update session config",
      },
    ],
    default: "createSession",
  },
  {
    displayName: "Operation",
    name: "operation",
    type: "options",
    noDataExpression: true,
    displayOptions: { show: { resource: ["messages"] } },
    options: [
      { name: "Send Text", value: "sendText", action: "Send text message" },
      {
        name: "Send Files",
        value: "sendFiles",
        action: "Send one or more files",
      },
      { name: "Send Media", value: "sendMedia", action: "Send image or video" },
      {
        name: "Send Document",
        value: "sendDocument",
        action: "Send document",
      },
      {
        name: "Send Audio",
        value: "sendAudio",
        action: "Send audio/voice note",
      },
      { name: "Send GIF", value: "sendGif", action: "Send GIF/video loop" },
      {
        name: "Send Sticker",
        value: "sendSticker",
        action: "Send sticker",
      },
      {
        name: "Send Button Template",
        value: "sendButton",
        action: "Send buttons",
      },
      { name: "Send List", value: "sendList", action: "Send list template" },
      {
        name: "Send Location",
        value: "sendLocation",
        action: "Share location",
      },
      { name: "Send Poll", value: "sendPoll", action: "Send poll" },
      {
        name: "Send Contact",
        value: "sendContact",
        action: "Send contact card",
      },
    ],
    default: "sendText",
  },
  {
    displayName: "Operation",
    name: "operation",
    type: "options",
    noDataExpression: true,
    displayOptions: { show: { resource: ["chats"] } },
    options: [
      { name: "List Chats", value: "listChats", action: "List chats" },
      {
        name: "Fetch Chat Messages",
        value: "getChatMessages",
        action: "Fetch chat messages",
      },
      { name: "Pin/Unpin Chat", value: "pinChat", action: "Toggle chat pin" },
      {
        name: "Pin/Unpin Message",
        value: "pinMessage",
        action: "Toggle message pin",
      },
      {
        name: "Mark Chat Read",
        value: "markChatRead",
        action: "Mark chat as read",
      },
      {
        name: "Archive Chat",
        value: "archiveChat",
        action: "Archive chat",
      },
      {
        name: "Unarchive Chat",
        value: "unarchiveChat",
        action: "Unarchive chat",
      },
      { name: "Mute Chat", value: "muteChat", action: "Mute chat" },
      { name: "Unmute Chat", value: "unmuteChat", action: "Unmute chat" },
      {
        name: "Clear Chat Messages",
        value: "clearChat",
        action: "Clear chat",
      },
    ],
    default: "listChats",
  },
  {
    displayName: "Operation",
    name: "operation",
    type: "options",
    noDataExpression: true,
    displayOptions: { show: { resource: ["messageAction"] } },
    options: [
      {
        name: "Delete Message",
        value: "deleteMessage",
        action: "Delete message",
      },
      { name: "Edit Message", value: "editMessage", action: "Edit message" },
      {
        name: "Mark Message Read",
        value: "markMessageRead",
        action: "Mark read",
      },
      {
        name: "React to Message",
        value: "reactToMessage",
        action: "Add reaction",
      },
      {
        name: "Remove Reaction",
        value: "removeReaction",
        action: "Remove reaction",
      },
      {
        name: "Revoke Message",
        value: "revokeMessage",
        action: "Revoke message",
      },
      { name: "Star Message", value: "starMessage", action: "Star message" },
      {
        name: "Unstar Message",
        value: "unstarMessage",
        action: "Unstar message",
      },
    ],
    default: "deleteMessage",
  },
  {
    displayName: "Operation",
    name: "operation",
    type: "options",
    noDataExpression: true,
    displayOptions: { show: { resource: ["group"] } },
    options: [
      { name: "List Groups", value: "listGroups", action: "List groups" },
      { name: "Group Info", value: "getGroupInfo", action: "Get group info" },
      {
        name: "Get Invite Link",
        value: "getGroupInvite",
        action: "Get invite link",
      },
      {
        name: "Revoke Invite Link",
        value: "revokeGroupInvite",
        action: "Revoke invite link",
      },
      {
        name: "Join via Link",
        value: "joinGroupByLink",
        action: "Join group using link",
      },
      {
        name: "Preview via Link",
        value: "previewGroupByLink",
        action: "Preview group via link",
      },
      { name: "Create Group", value: "createGroup", action: "Create group" },
      { name: "Leave Group", value: "leaveGroup", action: "Leave group" },
      { name: "Delete Group", value: "deleteGroup", action: "Delete group" },
      {
        name: "Update Group Name",
        value: "updateGroupName",
        action: "Update name",
      },
      {
        name: "Update Group Description",
        value: "updateGroupDescription",
        action: "Update description",
      },
      {
        name: "Toggle Announcement Mode",
        value: "setGroupAnnouncement",
        action: "Toggle announcement",
      },
      {
        name: "Lock Group Edits",
        value: "setGroupLocked",
        action: "Lock group",
      },
      {
        name: "List Participants",
        value: "getGroupParticipants",
        action: "List participants",
      },
      {
        name: "Add Participants",
        value: "addGroupParticipants",
        action: "Add participants",
      },
      {
        name: "Remove Participants",
        value: "removeGroupParticipants",
        action: "Remove participants",
      },
      {
        name: "Promote Participants",
        value: "promoteGroupParticipants",
        action: "Promote participants",
      },
      {
        name: "Demote Participants",
        value: "demoteGroupParticipants",
        action: "Demote participants",
      },
      {
        name: "Approve Join Request",
        value: "approveJoinRequest",
        action: "Approve join",
      },
      {
        name: "Reject Join Request",
        value: "rejectJoinRequest",
        action: "Reject join",
      },
      {
        name: "List Join Requests",
        value: "listJoinRequests",
        action: "List join requests",
      },
      {
        name: "Get Group Picture",
        value: "getGroupPicture",
        action: "Get picture",
      },
      {
        name: "Set Group Picture",
        value: "setGroupPicture",
        action: "Set picture",
      },
      {
        name: "Delete Group Picture",
        value: "deleteGroupPicture",
        action: "Delete picture",
      },
    ],
    default: "listGroups",
  },
  {
    displayName: "Operation",
    name: "operation",
    type: "options",
    noDataExpression: true,
    displayOptions: { show: { resource: ["profile"] } },
    options: [
      {
        name: "Get Profile Info",
        value: "getProfileInfo",
        action: "Get profile info",
      },
      {
        name: "Get Profile Picture",
        value: "getProfilePicture",
        action: "Get profile picture",
      },
      {
        name: "Set Profile Picture",
        value: "setProfilePicture",
        action: "Set profile picture",
      },
      {
        name: "Delete Profile Picture",
        value: "deleteProfilePicture",
        action: "Delete profile picture",
      },
      {
        name: "Get Privacy Settings",
        value: "getPrivacySettings",
        action: "Fetch privacy settings",
      },
      { name: "List Contacts", value: "listContacts", action: "List contacts" },
      {
        name: "Check On WhatsApp",
        value: "checkOnWhatsapp",
        action: "Check numbers",
      },
      {
        name: "Get Business Profile",
        value: "getBusinessProfile",
        action: "Get business profile",
      },
    ],
    default: "getProfileInfo",
  },
  {
    displayName: "Operation",
    name: "operation",
    type: "options",
    noDataExpression: true,
    displayOptions: { show: { resource: ["misc"] } },
    options: [
      {
        name: "Convert String to QR",
        value: "convertStringToQr",
        action: "Convert string to QR",
      },
      { name: "Base64 Helper", value: "base64", action: "Run base64 action" },
      { name: "Crypto Hash", value: "cryptoHash", action: "Compute hash" },
      { name: "Crypto HMAC", value: "cryptoHmac", action: "Compute HMAC" },
      {
        name: "Make Thumbnail",
        value: "thumbnail",
        action: "Create thumbnail",
      },
      {
        name: "Process Image",
        value: "processImage",
        action: "Process image",
      },
      {
        name: "Generate UUID/ULID",
        value: "uuidGenerate",
        action: "Generate UUID/ULID",
      },
      {
        name: "Validate UUID/ULID",
        value: "uuidValidate",
        action: "Validate UUID/ULID",
      },
      {
        name: "Decrypt WhatsApp File",
        value: "decryptWhatsappFile",
        action: "Decrypt media",
      },
      {
        name: "Decrypt Poll Vote",
        value: "decryptPollVote",
        action: "Decrypt poll vote",
      },
      {
        name: "Validate Phone",
        value: "validatePhone",
        action: "Validate phone",
      },
      { name: "Validate JID", value: "validateJid", action: "Validate JID" },
      {
        name: "Resolve JID or LID",
        value: "resolveJidOrLid",
        action: "Resolve JID or LID",
      },
    ],
    default: "convertStringToQr",
  },
];

const coreFields: INodeProperties[] = [
  {
    displayName: "Session",
    name: "sessionId",
    type: "resourceLocator",
    required: true,
    default: { mode: "list", value: "" },
    description:
      "Choose a session from WARest or type one manually if it does not appear in the list.",
    modes: [
      {
        displayName: "From List",
        name: "list",
        type: "list",
        placeholder: "Select a session",
        typeOptions: {
          searchListMethod: "searchSessions",
          searchFilterRequired: false,
        },
      },
      {
        displayName: "Session ID",
        name: "id",
        type: "string",
        placeholder: "my-session-id",
      },
    ],
    displayOptions: {
      show: {
        resource: [
          "messages",
          "chats",
          "messageAction",
          "group",
          "profile",
          "misc",
        ],
        operation: [
          ...messageSendOperations,
          ...chatOperations,
          ...messageActionOperations,
          ...groupOperations,
          ...profileOperations,
          "decryptPollVote",
        ],
      },
    },
  },
  {
    displayName: "Session ID",
    name: "sessionId",
    type: "resourceLocator",
    required: true,
    default: { mode: "list", value: "" },
    description:
      "Session identifier for session operations. Choose from list or type manually.",
    modes: [
      {
        displayName: "From List",
        name: "list",
        type: "list",
        placeholder: "Select a session",
        typeOptions: {
          searchListMethod: "searchSessions",
          searchFilterRequired: false,
        },
      },
      {
        displayName: "Session ID",
        name: "id",
        type: "string",
        placeholder: "my-session-id",
      },
    ],
    displayOptions: {
      show: {
        resource: ["session"],
        operation: [
          "createSession",
          "createPairCode",
          "logout",
          "reconnect",
          "devices",
          "deleteSession",
          "updateConfig",
        ],
      },
    },
  },
  {
    displayName: "Pairing Phone",
    name: "phone",
    type: "string",
    required: true,
    default: "",
    description: "Digits-only phone number including country code for pairing",
    displayOptions: {
      show: {
        resource: ["session"],
        operation: ["createPairCode"],
      },
    },
  },
  {
    displayName: "Recipient / Chat (to)",
    name: "to",
    type: "string",
    required: true,
    default: "",
    description:
      "Phone/JID or comma separated list. Leave empty only for operations that do not need it.",
    displayOptions: {
      show: {
        resource: ["messages", "chats", "messageAction"],
        operation: [
          ...messageSendOperations,
          "archiveChat",
          "unarchiveChat",
          "muteChat",
          "unmuteChat",
          "clearChat",
          ...messageActionOperations,
        ],
      },
    },
  },
  {
    displayName: "Chat ID / JID",
    name: "chatId",
    type: "string",
    required: true,
    default: "",
    description:
      "Chat identifier (jid) such as 62812@s.whatsapp.net or <id>@g.us",
    displayOptions: {
      show: {
        resource: ["chats"],
        operation: ["getChatMessages", "pinChat", "pinMessage", "markChatRead"],
      },
    },
  },
  {
    displayName: "Message ID",
    name: "messageId",
    type: "string",
    required: true,
    default: "",
    displayOptions: {
      show: {
        resource: ["messageAction"],
        operation: messageActionOperations as unknown as string[],
      },
    },
  },
  {
    displayName: "Message ID",
    name: "messageId",
    type: "string",
    required: true,
    default: "",
    description: "Message ID inside the chat",
    displayOptions: {
      show: { resource: ["chats"], operation: ["pinMessage"] },
    },
  },
  {
    displayName: "Pin?",
    name: "pin",
    type: "boolean",
    default: true,
    description: "Enable to pin, disable to unpin",
    displayOptions: {
      show: { resource: ["chats"], operation: ["pinChat", "pinMessage"] },
    },
  },
];

const messageFields: INodeProperties[] = [
  {
    displayName: "Message",
    name: "message",
    type: "string",
    typeOptions: { rows: 4 },
    default: "",
    required: true,
    description: "Text message content",
    displayOptions: {
      show: { resource: ["messages"], operation: ["sendText"] },
    },
  },
  {
    displayName: "Files",
    name: "files",
    type: "fixedCollection",
    typeOptions: { multipleValues: true },
    placeholder: "Add File",
    default: {},
    options: [
      {
        name: "fileEntry",
        displayName: "File",
        values: [
          {
            displayName: "Binary File",
            name: "binaryFile",
            type: "boolean",
            default: false,
            description:
              "Enable to use a binary property instead of a URL/path",
          },
          {
            displayName: "File URL/Data",
            name: "file",
            type: "string",
            default: "",
            required: true,
            description: "URL, local path, or data URI",
            displayOptions: { show: { binaryFile: [false] } },
          },
          {
            displayName: "Binary Property",
            name: "binaryProperty",
            type: "string",
            default: "",
            description:
              "Binary property that contains the file when mode is Binary Property",
            displayOptions: { show: { binaryFile: [true] } },
          },
          {
            displayName: "Filename",
            name: "filename",
            type: "string",
            default: "",
            description: "Override shown filename for this file",
          },
          {
            displayName: "Caption",
            name: "caption",
            type: "string",
            default: "",
            description: "Optional caption for this file",
          },
          {
            displayName: "Reply Message",
            name: "replyMessage",
            type: "boolean",
            default: false,
            description: "Enable to reply to a message",
          },
          {
            displayName: "Reply to Message ID",
            name: "replyMessageId",
            type: "string",
            default: "",
            description: "Quote a different message for this file",
            displayOptions: { show: { replyMessage: [true] } },
          },
        ],
      },
    ],
    displayOptions: {
      show: { resource: ["messages"], operation: ["sendFiles"] },
    },
  },
  {
    displayName: "Binary File",
    name: "mediaBinaryMode",
    type: "boolean",
    default: false,
    description: "Enable to use a binary property instead of a URL/path",
    displayOptions: {
      show: { resource: ["messages"], operation: ["sendMedia"] },
    },
  },
  {
    displayName: "Media",
    name: "media",
    type: "string",
    default: "",
    required: true,
    description: "URL, local path, or base64 data URI",
    displayOptions: {
      show: {
        resource: ["messages"],
        operation: ["sendMedia"],
        mediaBinaryMode: [false],
      },
    },
  },
  {
    displayName: "Media Binary Property",
    name: "mediaBinaryProperty",
    type: "string",
    default: "data",
    description: "Binary property for sendMedia when using binary input",
    displayOptions: {
      show: {
        resource: ["messages"],
        operation: ["sendMedia"],
        mediaBinaryMode: [true],
      },
    },
  },
  {
    displayName: "Binary File",
    name: "documentBinaryMode",
    type: "boolean",
    default: false,
    description: "Enable to use a binary property instead of a URL/path",
    displayOptions: {
      show: { resource: ["messages"], operation: ["sendDocument"] },
    },
  },
  {
    displayName: "Document",
    name: "document",
    type: "string",
    default: "",
    required: true,
    description: "Document URL, local path, or base64 data URI",
    displayOptions: {
      show: {
        resource: ["messages"],
        operation: ["sendDocument"],
        documentBinaryMode: [false],
      },
    },
  },
  {
    displayName: "Document Binary Property",
    name: "documentBinaryProperty",
    type: "string",
    default: "data",
    description: "Binary property for sendDocument when using binary input",
    displayOptions: {
      show: {
        resource: ["messages"],
        operation: ["sendDocument"],
        documentBinaryMode: [true],
      },
    },
  },
  {
    displayName: "Binary File",
    name: "audioBinaryMode",
    type: "boolean",
    default: false,
    description: "Enable to use a binary property instead of a URL/path",
    displayOptions: {
      show: { resource: ["messages"], operation: ["sendAudio"] },
    },
  },
  {
    displayName: "Audio",
    name: "audio",
    type: "string",
    default: "",
    required: true,
    description: "Audio URL, local path, or base64 data URI",
    displayOptions: {
      show: {
        resource: ["messages"],
        operation: ["sendAudio"],
        audioBinaryMode: [false],
      },
    },
  },
  {
    displayName: "Audio Binary Property",
    name: "audioBinaryProperty",
    type: "string",
    default: "data",
    description: "Binary property for sendAudio when using binary input",
    displayOptions: {
      show: {
        resource: ["messages"],
        operation: ["sendAudio"],
        audioBinaryMode: [true],
      },
    },
  },
  {
    displayName: "Binary File",
    name: "gifBinaryMode",
    type: "boolean",
    default: false,
    description: "Enable to use a binary property instead of a URL/path",
    displayOptions: {
      show: { resource: ["messages"], operation: ["sendGif"] },
    },
  },
  {
    displayName: "GIF/Video",
    name: "gif",
    type: "string",
    default: "",
    required: true,
    description: "GIF/video URL, local path, or data URI",
    displayOptions: {
      show: {
        resource: ["messages"],
        operation: ["sendGif"],
        gifBinaryMode: [false],
      },
    },
  },
  {
    displayName: "GIF/Video Binary Property",
    name: "gifBinaryProperty",
    type: "string",
    default: "data",
    description: "Binary property for sendGif when using binary input",
    displayOptions: {
      show: {
        resource: ["messages"],
        operation: ["sendGif"],
        gifBinaryMode: [true],
      },
    },
  },
  {
    displayName: "Binary File",
    name: "stickerBinaryMode",
    type: "boolean",
    default: false,
    description: "Enable to use a binary property instead of a URL/path",
    displayOptions: {
      show: { resource: ["messages"], operation: ["sendSticker"] },
    },
  },
  {
    displayName: "Sticker",
    name: "sticker",
    type: "string",
    default: "",
    required: true,
    description: "Sticker image/GIF URL, path, or data URI",
    displayOptions: {
      show: {
        resource: ["messages"],
        operation: ["sendSticker"],
        stickerBinaryMode: [false],
      },
    },
  },
  {
    displayName: "Sticker Binary Property",
    name: "stickerBinaryProperty",
    type: "string",
    default: "data",
    description: "Binary property for sendSticker when using binary input",
    displayOptions: {
      show: {
        resource: ["messages"],
        operation: ["sendSticker"],
        stickerBinaryMode: [true],
      },
    },
  },
  {
    displayName: "Body Message",
    name: "text",
    type: "string",
    typeOptions: { rows: 3 },
    default: "",
    required: true,
    description: "Message string shown above buttons",
    displayOptions: {
      show: { resource: ["messages"], operation: ["sendButton", "sendList"] },
    },
  },
  {
    displayName: "Footer",
    name: "footer",
    type: "string",
    default: "",
    displayOptions: {
      show: { resource: ["messages"], operation: ["sendButton", "sendList"] },
    },
  },
  {
    displayName: "Image (URL/Data)",
    name: "image",
    type: "string",
    default: "",
    description: "Optional header image for button/list messages",
    displayOptions: {
      show: { resource: ["messages"], operation: ["sendButton", "sendList"] },
    },
  },
  {
    displayName: "Buttons",
    name: "buttons",
    type: "fixedCollection",
    typeOptions: { multipleValues: true, maxItems: 3 },
    placeholder: "Add Button (max 3)",
    default: {},
    options: [
      {
        name: "button",
        displayName: "Button",
        values: [
          {
            displayName: "Type",
            name: "type",
            type: "options",
            default: "reply",
            options: [
              { name: "Reply", value: "reply" },
              { name: "URL", value: "url" },
              { name: "Call", value: "call" },
              { name: "Copy", value: "copy" },
            ],
          },
          {
            displayName: "Title",
            name: "displayText",
            type: "string",
            required: true,
            default: "",
          },
          {
            displayName: "Button ID",
            name: "id",
            type: "string",
            default: "",
            description: "Identifier returned when the button is tapped",
            displayOptions: { show: { type: ["reply"] } },
          },
          {
            displayName: "URL",
            name: "url",
            type: "string",
            default: "",
            displayOptions: { show: { type: ["url"] } },
          },
          {
            displayName: "Phone Number",
            name: "phoneNumber",
            type: "string",
            default: "",
            displayOptions: { show: { type: ["call"] } },
          },
          {
            displayName: "Copy Code",
            name: "copyCode",
            type: "string",
            default: "",
            description: "Text/code to copy when the button is tapped",
            displayOptions: { show: { type: ["copy"] } },
          },
        ],
      },
    ],
    displayOptions: {
      show: { resource: ["messages"], operation: ["sendButton"] },
    },
  },
  {
    displayName: "Button Text",
    name: "listButtonText",
    type: "string",
    required: true,
    default: "",
    description: "Button shown under the list",
    displayOptions: {
      show: { resource: ["messages"], operation: ["sendList"] },
    },
  },

  {
    displayName: "Sections",
    name: "listSections",
    type: "fixedCollection",
    typeOptions: { multipleValues: true },
    placeholder: "Add Section",
    default: {},
    options: [
      {
        name: "section",
        displayName: "Section",
        values: [
          {
            displayName: "Section Title",
            description: "Title for this section",
            name: "title",
            type: "string",
            default: "",
          },
          {
            displayName: "Rows",
            name: "rows",
            type: "fixedCollection",
            typeOptions: { multipleValues: true },
            placeholder: "Add Row",
            default: {},
            options: [
              {
                name: "row",
                displayName: "Row",
                values: [
                  {
                    displayName: "Row ID",
                    description: "Identifier for this row",
                    name: "id",
                    type: "string",
                    required: true,
                    default: "",
                  },
                  {
                    displayName: "Title",
                    description: "Title for this row",
                    name: "title",
                    type: "string",
                    required: true,
                    default: "",
                  },
                  {
                    displayName: "Description",
                    description: "Optional description for this row",
                    name: "description",
                    type: "string",
                    default: "",
                  },
                  {
                    displayName: "Header",
                    description: "Optional header for this row",
                    name: "header",
                    type: "string",
                    default: "",
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
    displayOptions: {
      show: { resource: ["messages"], operation: ["sendList"] },
    },
  },
  {
    displayName: "Location",
    name: "location",
    type: "fixedCollection",
    default: {},
    options: [
      {
        name: "coordinates",
        displayName: "Coordinates",
        values: [
          {
            displayName: "Latitude",
            name: "latitude",
            type: "number",
            required: true,
            default: -0.123456,
          },
          {
            displayName: "Longitude",
            name: "longitude",
            type: "number",
            required: true,
            default: 0.123456,
          },
          {
            displayName: "Name",
            name: "name",
            type: "string",
            default: "",
          },
          {
            displayName: "Address",
            name: "address",
            type: "string",
            default: "",
          },
        ],
      },
    ],
    displayOptions: {
      show: { resource: ["messages"], operation: ["sendLocation"] },
    },
  },
  {
    displayName: "Question",
    name: "question",
    type: "string",
    required: true,
    default: "",
    displayOptions: {
      show: { resource: ["messages"], operation: ["sendPoll"] },
    },
  },
  {
    displayName: "Options",
    name: "options",
    type: "fixedCollection",
    typeOptions: { multipleValues: true },
    placeholder: "Add Option",
    default: {},
    options: [
      {
        name: "option",
        displayName: "Option",
        values: [
          {
            displayName: "Option Text",
            name: "value",
            type: "string",
            required: true,
            default: "",
          },
        ],
      },
    ],
    displayOptions: {
      show: { resource: ["messages"], operation: ["sendPoll"] },
    },
  },
  {
    displayName: "Contact",
    name: "contact",
    type: "fixedCollection",
    default: {},
    options: [
      {
        name: "contactFields",
        displayName: "Contact",
        values: [
          {
            displayName: "Name",
            name: "name",
            type: "string",
            default: "",
          },
          {
            displayName: "Full Name",
            name: "fullName",
            type: "string",
            default: "",
          },
          {
            displayName: "Phone",
            name: "phone",
            type: "string",
            default: "",
          },
          {
            displayName: "Organization",
            name: "organization",
            type: "string",
            default: "",
          },
          {
            displayName: "Email",
            name: "email",
            type: "string",
            default: "",
          },
        ],
      },
    ],
    displayOptions: {
      show: { resource: ["messages"], operation: ["sendContact"] },
    },
  },
  {
    displayName: "Caption",
    name: "caption",
    type: "string",
    default: "",
    displayOptions: {
      show: {
        resource: ["messages"],
        operation: ["sendMedia", "sendDocument", "sendGif", "sendFiles"],
      },
    },
  },
  {
    displayName: "Custom Filename",
    name: "customFilename",
    type: "boolean",
    default: false,
    description: "Enable to override filename for document uploads",
    displayOptions: {
      show: { resource: ["messages"], operation: ["sendDocument"] },
    },
  },
  {
    displayName: "Filename",
    name: "filename",
    type: "string",
    default: "",
    description: "Override filename for document uploads",
    displayOptions: {
      show: {
        resource: ["messages"],
        operation: ["sendDocument"],
        customFilename: [true],
      },
    },
  },
  {
    displayName: "Compress Media",
    name: "compress",
    type: "boolean",
    default: false,
    displayOptions: {
      show: {
        resource: ["messages"],
        operation: ["sendMedia", "sendGif", "sendSticker"],
      },
    },
  },
  {
    displayName: "View Once",
    name: "viewOnce",
    type: "boolean",
    default: false,
    description: "Send as view-once image/video when supported",
    displayOptions: {
      show: { resource: ["messages"], operation: ["sendMedia"] },
    },
  },
  {
    displayName: "Send as Voice Note",
    name: "isVN",
    type: "boolean",
    default: false,
    description: "Send audio as a voice note",
    displayOptions: {
      show: { resource: ["messages"], operation: ["sendAudio"] },
    },
  },

  {
    displayName: "Max Selections",
    name: "maxSelection",
    type: "number",
    default: 1,
    description: "Limit how many poll options can be picked",
    displayOptions: {
      show: { resource: ["messages"], operation: ["sendPoll"] },
    },
  },
  {
    displayName: "Additional Fields",
    name: "messageAdditionalFields",
    type: "collection",
    default: {},
    placeholder: "Add Field",
    options: [
      {
        displayName: "Presence Indicator",
        name: "presence",
        type: "boolean",
        default: false,
        description: "Send typing/recording indicator before sending",
      },
      {
        displayName: "Reply to Message ID",
        name: "replyMessageId",
        type: "string",
        default: "",
      },
      {
        displayName: "Mark as Forwarded",
        name: "isForwarded",
        type: "boolean",
        default: false,
      },
    ],
    displayOptions: { show: { resource: ["messages"] } },
  },
];

const chatFields: INodeProperties[] = [
  {
    displayName: "Additional Fields",
    name: "chatAdditionalFields",
    type: "collection",
    default: {},
    placeholder: "Add Field",
    displayOptions: {
      show: {
        resource: ["chats"],
        operation: ["listChats"],
      },
    },
    options: [
      {
        displayName: "Limit",
        name: "limit",
        type: "number",
        default: 10,
      },
      {
        displayName: "Offset",
        name: "offset",
        type: "number",
        default: 0,
      },
      {
        displayName: "Has Media Only",
        name: "hasMedia",
        type: "boolean",
        default: false,
      },
      {
        displayName: "Sort By",
        name: "sortBy",
        type: "options",
        default: "lastMessage",
        options: [
          { name: "Last Message", value: "lastMessage" },
          { name: "Unread Count", value: "unreadCount" },
          { name: "Name", value: "name" },
        ],
      },
      {
        displayName: "Sort Order",
        name: "sortOrder",
        type: "options",
        default: "desc",
        options: [
          { name: "Ascending", value: "asc" },
          { name: "Descending", value: "desc" },
        ],
      },
      {
        displayName: "Search",
        name: "search",
        type: "string",
        default: "",
        description: "Filter chats or messages by text",
      },
    ],
  },
  {
    displayName: "Additional Fields",
    name: "chatAdditionalFields",
    type: "collection",
    default: {},
    placeholder: "Add Field",
    displayOptions: {
      show: {
        resource: ["chats"],
        operation: ["getChatMessages"],
      },
    },
    options: [
      {
        displayName: "Limit",
        name: "limit",
        type: "number",
        default: 10,
      },
      {
        displayName: "Offset",
        name: "offset",
        type: "number",
        default: 0,
      },
      {
        displayName: "Search",
        name: "search",
        type: "string",
        default: "",
        description: "Filter chats or messages by text",
      },
      {
        displayName: "Start Time (ms)",
        name: "startTime",
        type: "number",
        default: 0,
        description: "Only messages newer than this timestamp",
      },
      {
        displayName: "End Time (ms)",
        name: "endTime",
        type: "number",
        default: 0,
        description: "Only messages older than this timestamp",
      },
      {
        displayName: "Media Only",
        name: "mediaOnly",
        type: "boolean",
        default: false,
      },
      {
        displayName: "Only Sent by Me",
        name: "isFromMe",
        type: "boolean",
        default: false,
      },
    ],
  },
  {
    displayName: "Additional Fields",
    name: "chatAdditionalFields",
    type: "collection",
    default: {},
    placeholder: "Add Field",
    displayOptions: {
      show: {
        resource: ["chats"],
        operation: ["markChatRead"],
      },
    },
    options: [
      {
        displayName: "Messages to Mark Read",
        name: "messages",
        type: "number",
        default: 0,
        description: "Number of inbound messages to acknowledge (0 = all)",
      },
      {
        displayName: "Days to Mark Read",
        name: "days",
        type: "number",
        default: 0,
        description: "Limit marking read to the last N days when messages = 0",
      },
    ],
  },
  {
    displayName: "Additional Fields",
    name: "chatAdditionalFields",
    type: "collection",
    default: {},
    placeholder: "Add Field",
    displayOptions: {
      show: {
        resource: ["chats"],
        operation: ["muteChat"],
      },
    },
    options: [
      {
        displayName: "Mute Duration (minutes)",
        name: "duration",
        type: "number",
        default: 60,
      },
    ],
  },
];

const messageActionFields: INodeProperties[] = [
  {
    displayName: "New Message",
    name: "message",
    type: "string",
    typeOptions: { rows: 3 },
    default: "",
    required: true,
    displayOptions: {
      show: { resource: ["messageAction"], operation: ["editMessage"] },
    },
  },
  {
    displayName: "Emoji",
    name: "emoji",
    type: "string",
    default: "👍",
    required: true,
    displayOptions: {
      show: { resource: ["messageAction"], operation: ["reactToMessage"] },
    },
  },
  {
    displayName: "Additional Fields",
    name: "messageActionAdditionalFields",
    type: "collection",
    default: {},
    placeholder: "Add Field",
    options: [
      {
        displayName: "With Media",
        name: "withMedia",
        type: "boolean",
        default: true,
        description: "Delete media blob too",
      },
      {
        displayName: "Delete For Me",
        name: "deleteForMe",
        type: "boolean",
        default: false,
        description: "Also delete from current account",
      },
    ],
    displayOptions: {
      show: {
        resource: ["messageAction"],
        operation: ["deleteMessage", "revokeMessage"],
      },
    },
  },
];

const groupFields: INodeProperties[] = [
  {
    displayName: "Group ID",
    name: "groupId",
    type: "string",
    required: true,
    default: "",
    description: "Group JID ending with @g.us or raw id",
    displayOptions: {
      show: {
        resource: ["group"],
        operation: [
          "getGroupInfo",
          "getGroupInvite",
          "revokeGroupInvite",
          "leaveGroup",
          "deleteGroup",
          "updateGroupName",
          "updateGroupDescription",
          "setGroupAnnouncement",
          "setGroupLocked",
          "getGroupParticipants",
          "addGroupParticipants",
          "removeGroupParticipants",
          "promoteGroupParticipants",
          "demoteGroupParticipants",
          "approveJoinRequest",
          "rejectJoinRequest",
          "listJoinRequests",
          "getGroupPicture",
          "setGroupPicture",
          "deleteGroupPicture",
        ],
      },
    },
  },
  {
    displayName: "Invite Link or Code",
    name: "inviteLink",
    type: "string",
    required: true,
    default: "",
    displayOptions: {
      show: {
        resource: ["group"],
        operation: ["joinGroupByLink", "previewGroupByLink"],
      },
    },
  },
  {
    displayName: "Group Name",
    name: "groupName",
    type: "string",
    required: true,
    default: "",
    displayOptions: {
      show: {
        resource: ["group"],
        operation: ["createGroup", "updateGroupName"],
      },
    },
  },
  {
    displayName: "Group Description",
    name: "groupDescription",
    type: "string",
    typeOptions: { rows: 3 },
    required: true,
    default: "",
    displayOptions: {
      show: {
        resource: ["group"],
        operation: ["updateGroupDescription"],
      },
    },
  },
  {
    displayName: "Participants",
    name: "participants",
    type: "fixedCollection",
    typeOptions: { multipleValues: true },
    placeholder: "Add Participant",
    default: {},
    options: [
      {
        name: "participant",
        displayName: "Participant",
        values: [
          {
            displayName: "JID or Phone",
            name: "value",
            type: "string",
            default: "",
            required: true,
          },
        ],
      },
    ],
    displayOptions: {
      show: {
        resource: ["group"],
        operation: [
          "createGroup",
          "addGroupParticipants",
          "removeGroupParticipants",
          "promoteGroupParticipants",
          "demoteGroupParticipants",
          "approveJoinRequest",
          "rejectJoinRequest",
        ],
      },
    },
  },
  {
    displayName: "Announcement Mode",
    name: "announcement",
    type: "boolean",
    default: true,
    required: true,
    description: "Only admins can send messages",
    displayOptions: {
      show: { resource: ["group"], operation: ["setGroupAnnouncement"] },
    },
  },
  {
    displayName: "Locked (Only admins can edit)",
    name: "locked",
    type: "boolean",
    default: true,
    required: true,
    displayOptions: {
      show: { resource: ["group"], operation: ["setGroupLocked"] },
    },
  },
  {
    displayName: "Group Picture",
    name: "picture",
    type: "string",
    default: "",
    required: true,
    description: "URL, local path, or data URI",
    displayOptions: {
      show: { resource: ["group"], operation: ["setGroupPicture"] },
    },
  },
];

const profileFields: INodeProperties[] = [
  {
    displayName: "Picture",
    name: "picture",
    type: "string",
    default: "",
    required: true,
    description: "Profile picture URL, local path, or data URI",
    displayOptions: {
      show: { resource: ["profile"], operation: ["setProfilePicture"] },
    },
  },
  {
    displayName: "Phone Numbers",
    name: "checkNumbers",
    type: "string",
    required: true,
    default: "",
    description: "Comma separated numbers (e.g. 62812,62813)",
    displayOptions: {
      show: {
        resource: ["profile"],
        operation: ["checkOnWhatsapp", "getBusinessProfile"],
      },
    },
  },
  {
    displayName: "Additional Fields",
    name: "profileAdditionalFields",
    type: "collection",
    default: {},
    placeholder: "Add Field",
    options: [
      {
        displayName: "Type",
        name: "type",
        type: "options",
        default: "contacts",
        options: [
          { name: "Contacts", value: "contacts" },
          { name: "Groups", value: "groups" },
        ],
      },
      {
        displayName: "Deep Lookup",
        name: "deep",
        type: "boolean",
        default: false,
      },
      {
        displayName: "Group IDs (CSV)",
        name: "groupIds",
        type: "string",
        default: "",
      },
      {
        displayName: "Limit",
        name: "limit",
        type: "number",
        default: 15,
      },
      {
        displayName: "Offset",
        name: "offset",
        type: "number",
        default: 0,
      },
    ],
    displayOptions: {
      show: {
        resource: ["profile"],
        operation: ["listContacts", "checkOnWhatsapp"],
      },
    },
  },
];

const miscFields: INodeProperties[] = [
  {
    displayName: "Target Format",
    name: "target",
    type: "options",
    options: [
      { name: "Base64", value: "base64" },
      { name: "SVG", value: "svg" },
      { name: "PNG", value: "png" },
      { name: "JPG", value: "jpg" },
      { name: "JPEG", value: "jpeg" },
      { name: "WEBP", value: "webp" },
    ],
    default: "png",
    required: true,
    displayOptions: {
      show: { resource: ["misc"], operation: ["convertStringToQr"] },
    },
  },
  {
    displayName: "String to Convert",
    name: "string",
    type: "string",
    typeOptions: { rows: 3 },
    default: "",
    required: true,
    displayOptions: {
      show: { resource: ["misc"], operation: ["convertStringToQr"] },
    },
  },
  {
    displayName: "Action",
    name: "action",
    type: "options",
    options: [
      { name: "Encode", value: "encode" },
      { name: "Decode", value: "decode" },
    ],
    default: "encode",
    required: true,
    displayOptions: {
      show: { resource: ["misc"], operation: ["base64"] },
    },
  },
  {
    displayName: "Input",
    name: "input",
    type: "string",
    typeOptions: { rows: 3 },
    default: "",
    required: true,
    displayOptions: {
      show: {
        resource: ["misc"],
        operation: ["base64", "cryptoHash", "cryptoHmac"],
      },
    },
  },
  {
    displayName: "Key",
    name: "key",
    type: "string",
    typeOptions: { password: true },
    default: "",
    required: true,
    displayOptions: { show: { resource: ["misc"], operation: ["cryptoHmac"] } },
  },
  {
    displayName: "File",
    name: "file",
    type: "string",
    typeOptions: { rows: 3 },
    default: "",
    required: true,
    description: "Base64 payload, HTTPS URL, or local path",
    displayOptions: {
      show: {
        resource: ["misc"],
        operation: ["thumbnail", "processImage", "decryptWhatsappFile"],
      },
    },
  },
  {
    displayName: "Media Type",
    name: "type",
    type: "options",
    default: "image",
    options: [
      { name: "Image", value: "image" },
      { name: "Video", value: "video" },
    ],
    required: true,
    displayOptions: { show: { resource: ["misc"], operation: ["thumbnail"] } },
  },
  {
    displayName: "Media Key (base64)",
    name: "mediaKey",
    type: "string",
    default: "",
    required: true,
    displayOptions: {
      show: { resource: ["misc"], operation: ["decryptWhatsappFile"] },
    },
  },
  {
    displayName: "Poll Update Vote (JSON)",
    name: "pollUpdateVote",
    type: "json",
    typeOptions: { rows: 6 },
    default: "",
    description: "Raw pollUpdateVote object from webhook payloads",
    required: true,
    displayOptions: {
      show: { resource: ["misc"], operation: ["decryptPollVote"] },
    },
  },
  {
    displayName: "Phone Number",
    name: "phone",
    type: "string",
    required: true,
    default: "",
    description: "Phone number to validate",
    displayOptions: {
      show: { resource: ["misc"], operation: ["validatePhone"] },
    },
  },
  {
    displayName: "JID",
    name: "jid",
    type: "string",
    required: true,
    default: "",
    description: "JID to validate",
    displayOptions: {
      show: { resource: ["misc"], operation: ["validateJid"] },
    },
  },
  {
    displayName: "Value",
    name: "value",
    type: "string",
    required: true,
    default: "",
    description: "UUID/ULID to validate",
    displayOptions: {
      show: { resource: ["misc"], operation: ["uuidValidate"] },
    },
  },
  {
    displayName: "Input Value",
    name: "input",
    type: "string",
    required: true,
    default: "",
    description: "JID/LID/phone to resolve",
    displayOptions: {
      show: { resource: ["misc"], operation: ["resolveJidOrLid"] },
    },
  },
  {
    displayName: "Additional Fields",
    name: "miscAdditionalFields",
    type: "fixedCollection",
    typeOptions: { multipleValues: true },
    default: {},
    options: [
      {
        name: "qr",
        displayName: "QR Options",
        values: [
          {
            displayName: "Encoding",
            name: "encoding",
            type: "string",
            default: "utf8",
          },
          {
            displayName: "Output",
            name: "output",
            type: "options",
            default: "string",
            options: [
              { name: "String", value: "string" },
              { name: "Base64", value: "base64" },
              { name: "URL", value: "url" },
              { name: "File", value: "file" },
            ],
          },
        ],
      },
      {
        name: "media",
        displayName: "Media/Thumbnail",
        values: [
          {
            displayName: "Output",
            name: "output",
            type: "options",
            default: "file",
            options: [
              { name: "String", value: "string" },
              { name: "Base64", value: "base64" },
              { name: "URL", value: "url" },
              { name: "File", value: "file" },
            ],
          },
          { displayName: "Width", name: "width", type: "number", default: 320 },
          {
            displayName: "Height",
            name: "height",
            type: "number",
            default: 320,
          },
          {
            displayName: "Frame Count (video)",
            name: "count",
            type: "number",
            default: 0,
          },
          {
            displayName: "Mime Type",
            name: "mimeType",
            type: "string",
            default: "",
          },
          {
            displayName: "File SHA256 (base64)",
            name: "fileSha256",
            type: "string",
            default: "",
          },
        ],
      },
      {
        name: "imageProcessing",
        displayName: "Image Processing",
        values: [
          {
            displayName: "Convert To",
            name: "convert",
            type: "options",
            default: "png",
            options: [
              { name: "PNG", value: "png" },
              { name: "JPG", value: "jpg" },
              { name: "JPEG", value: "jpeg" },
              { name: "WEBP", value: "webp" },
              { name: "TIFF", value: "tiff" },
              { name: "AVIF", value: "avif" },
            ],
          },
          {
            displayName: "Resize Width",
            name: "resizeWidth",
            type: "number",
            default: 0,
          },
          {
            displayName: "Resize Height",
            name: "resizeHeight",
            type: "number",
            default: 0,
          },
          {
            displayName: "Resize Fit",
            name: "fit",
            type: "options",
            default: "cover",
            options: [
              { name: "Cover", value: "cover" },
              { name: "Contain", value: "contain" },
              { name: "Fill", value: "fill" },
              { name: "Inside", value: "inside" },
              { name: "Outside", value: "outside" },
            ],
          },
          {
            displayName: "Quality (1-100)",
            name: "quality",
            type: "number",
            default: 80,
          },
        ],
      },
      {
        name: "crypto",
        displayName: "Crypto",
        values: [
          {
            displayName: "Algorithm",
            name: "algo",
            type: "string",
            default: "sha256",
          },
          {
            displayName: "Output Encoding",
            name: "cryptoOutput",
            type: "options",
            default: "hex",
            options: [
              { name: "Hex", value: "hex" },
              { name: "Base64", value: "base64" },
            ],
          },
        ],
      },
      {
        name: "uuid",
        displayName: "UUID/ULID",
        values: [
          {
            displayName: "ID Type",
            name: "type",
            type: "options",
            default: "uuid",
            options: [
              { name: "UUID", value: "uuid" },
              { name: "ULID", value: "ulid" },
            ],
          },
          {
            displayName: "Version",
            name: "version",
            type: "options",
            default: "v4",
            options: [
              { name: "v1", value: "v1" },
              { name: "v3", value: "v3" },
              { name: "v4", value: "v4" },
              { name: "v5", value: "v5" },
              { name: "Nil", value: "nil" },
            ],
          },
          {
            displayName: "Namespace",
            name: "namespace",
            type: "string",
            default: "",
          },
          { displayName: "Name", name: "name", type: "string", default: "" },
          {
            displayName: "Format Mask",
            name: "format",
            type: "string",
            default: "",
            description: "Optional pattern such as xxxx-xxxx",
          },
          { displayName: "Count", name: "count", type: "number", default: 1 },
        ],
      },
      {
        name: "pollDecrypt",
        displayName: "Poll Decrypt",
        values: [
          {
            displayName: "Poll Secret (base64)",
            name: "pollEncKey",
            type: "string",
            default: "",
          },
          {
            displayName: "Poll Message ID",
            name: "pollMsgId",
            type: "string",
            default: "",
          },
          {
            displayName: "Poll Creator JID",
            name: "pollCreatorJid",
            type: "string",
            default: "",
          },
          {
            displayName: "Voter JID",
            name: "voterJid",
            type: "string",
            default: "",
          },
        ],
      },
      {
        name: "validation",
        displayName: "Validation",
        values: [
          {
            displayName: "Country (ISO)",
            name: "country",
            type: "string",
            default: "",
          },
          {
            displayName: "Session ID",
            name: "sessionId",
            type: "string",
            default: "",
            description: "Optional session context for validation helpers",
          },
        ],
      },
    ],
    displayOptions: {
      show: {
        resource: ["misc"],
        operation: [
          "convertStringToQr",
          "base64",
          "cryptoHash",
          "cryptoHmac",
          "thumbnail",
          "processImage",
          "uuidGenerate",
          "uuidValidate",
          "decryptWhatsappFile",
          "decryptPollVote",
          "validatePhone",
          "validateJid",
          "resolveJidOrLid",
        ],
      },
    },
  },
];

const serverFields: INodeProperties[] = [
  {
    displayName: "Schedule (HH:MM or 0 to cancel)",
    name: "schedule",
    type: "string",
    default: "",
    required: true,
    displayOptions: {
      show: { resource: ["server"], operation: ["scheduleRestart"] },
    },
  },
  {
    displayName: "Additional Fields",
    name: "serverAdditionalFields",
    type: "collection",
    default: {},
    placeholder: "Add Field",
    options: [
      {
        displayName: "Reason",
        name: "reason",
        type: "string",
        default: "",
      },
      {
        displayName: "Delay (ms)",
        name: "delayMs",
        type: "number",
        default: 0,
      },
      {
        displayName: "Timezone",
        name: "timezone",
        type: "string",
        default: "",
        description: "IANA timezone, e.g. Asia/Jakarta",
      },
    ],
    displayOptions: {
      show: { resource: ["server"], operation: ["restart", "scheduleRestart"] },
    },
  },
];

const sessionFields: INodeProperties[] = [
  {
    displayName: "Additional Fields",
    name: "sessionAdditionalFields",
    type: "collection",
    default: {},
    placeholder: "Add Field",
    options: [
      {
        displayName: "Webhook URL",
        name: "webhookUrl",
        type: "string",
        default: "",
        description: "HTTPS URL for webhook callbacks",
      },
      {
        displayName: "Webhook Secret",
        name: "webhookSecret",
        type: "string",
        default: "",
        description: "Shared secret for webhook signing",
      },
      {
        displayName: "Preflight",
        name: "preflight",
        type: "boolean",
        default: false,
        description: "Trigger a preflight call before saving config",
      },
    ],
    displayOptions: {
      show: { resource: ["session"], operation: ["updateConfig"] },
    },
  },
];

const properties: INodeProperties[] = [
  ...selectorProperties,
  ...coreFields,
  ...serverFields,
  ...sessionFields,
  ...messageFields,
  ...chatFields,
  ...messageActionFields,
  ...groupFields,
  ...profileFields,
  ...miscFields,
];

const binarySourceConfig: Record<
  string,
  { field: string; binaryParam: string }
> = {
  sendMedia: { field: "media", binaryParam: "mediaBinaryProperty" },
  sendDocument: { field: "document", binaryParam: "documentBinaryProperty" },
  sendAudio: { field: "audio", binaryParam: "audioBinaryProperty" },
  sendGif: { field: "gif", binaryParam: "gifBinaryProperty" },
  sendSticker: { field: "sticker", binaryParam: "stickerBinaryProperty" },
};

const OPERATION_CONFIG: Record<string, OperationConfig> = {
  // Server
  "server:ping": { method: "GET", path: "/api/v1/server/ping" },
  "server:info": { method: "GET", path: "/api/v1/server/info" },
  "server:health": { method: "GET", path: "/api/v1/server/healthz" },
  "server:ready": { method: "GET", path: "/api/v1/server/ready" },
  "server:cpuHistory": { method: "GET", path: "/api/v1/server/cpu-history" },
  "server:restart": { method: "POST", path: "/api/v1/server/restart" },
  "server:scheduleRestart": {
    method: "POST",
    path: "/api/v1/server/restart/scheduled",
    bodyFields: ["schedule"],
  },

  // Session
  "session:createSession": {
    method: "GET",
    path: "/api/v1/session/create",
    qsFields: ["sessionId"],
  },
  "session:createPairCode": {
    method: "GET",
    path: "/api/v1/session/create/pair-code",
    qsFields: ["sessionId", "phone"],
  },
  "session:logout": {
    method: "GET",
    path: "/api/v1/session/logout",
    qsFields: ["sessionId"],
  },
  "session:reconnect": {
    method: "GET",
    path: "/api/v1/session/reconnect",
    qsFields: ["sessionId"],
  },
  "session:devices": {
    method: "GET",
    path: "/api/v1/session/devices",
    qsFields: ["sessionId"],
  },
  "session:listSessions": { method: "GET", path: "/api/v1/session/list" },
  "session:deleteSession": {
    method: "DELETE",
    path: "/api/v1/session/delete",
    bodyFields: ["sessionId"],
  },
  "session:updateConfig": {
    method: "POST",
    path: "/api/v1/session/{sessionId}/config",
    pathParams: ["sessionId"],
  },

  // Messages - sending
  "messages:sendText": {
    method: "POST",
    path: "/api/v1/messages/send/text",
    bodyFields: ["sessionId", "to", "message"],
  },
  "messages:sendFiles": {
    method: "POST",
    path: "/api/v1/messages/send/files",
    bodyFields: ["sessionId", "to", "files"],
  },
  "messages:sendMedia": {
    method: "POST",
    path: "/api/v1/messages/send/media",
    bodyFields: ["sessionId", "to", "media"],
  },
  "messages:sendDocument": {
    method: "POST",
    path: "/api/v1/messages/send/document",
    bodyFields: ["sessionId", "to", "document"],
  },
  "messages:sendAudio": {
    method: "POST",
    path: "/api/v1/messages/send/audio",
    bodyFields: ["sessionId", "to", "audio"],
  },
  "messages:sendGif": {
    method: "POST",
    path: "/api/v1/messages/send/gif",
    bodyFields: ["sessionId", "to", "gif"],
  },
  "messages:sendSticker": {
    method: "POST",
    path: "/api/v1/messages/send/sticker",
    bodyFields: ["sessionId", "to", "sticker"],
  },
  "messages:sendButton": {
    method: "POST",
    path: "/api/v1/messages/send/button",
    bodyFields: ["sessionId", "to", "text", "buttons"],
  },
  "messages:sendList": {
    method: "POST",
    path: "/api/v1/messages/send/list",
    bodyFields: ["sessionId", "to", "text"],
  },
  "messages:sendLocation": {
    method: "POST",
    path: "/api/v1/messages/send/location",
    bodyFields: ["sessionId", "to", "location"],
  },
  "messages:sendPoll": {
    method: "POST",
    path: "/api/v1/messages/send/poll",
    bodyFields: ["sessionId", "to", "question", "options"],
  },
  "messages:sendContact": {
    method: "POST",
    path: "/api/v1/messages/send/contact",
    bodyFields: ["sessionId", "to", "contact"],
  },

  // Chats
  "chats:listChats": {
    method: "GET",
    path: "/api/v1/chats",
    qsFields: ["sessionId"],
  },
  "chats:getChatMessages": {
    method: "GET",
    path: "/api/v1/chats/{chatId}/messages",
    pathParams: ["chatId"],
    qsFields: ["sessionId"],
  },
  "chats:pinChat": {
    method: "POST",
    path: "/api/v1/chats/{chatId}/pin",
    pathParams: ["chatId"],
    bodyFields: ["sessionId", "pin"],
  },
  "chats:pinMessage": {
    method: "POST",
    path: "/api/v1/chats/{chatId}/messages/{messageId}/pin",
    pathParams: ["chatId", "messageId"],
    bodyFields: ["sessionId", "pin"],
  },
  "chats:markChatRead": {
    method: "POST",
    path: "/api/v1/chats/{chatId}/read",
    pathParams: ["chatId"],
    bodyFields: ["sessionId"],
  },
  "chats:archiveChat": {
    method: "POST",
    path: "/api/v1/messages/action/archive",
    bodyFields: ["sessionId", "to"],
  },
  "chats:unarchiveChat": {
    method: "POST",
    path: "/api/v1/messages/action/unarchive",
    bodyFields: ["sessionId", "to"],
  },
  "chats:muteChat": {
    method: "POST",
    path: "/api/v1/messages/action/mute",
    bodyFields: ["sessionId", "to"],
  },
  "chats:unmuteChat": {
    method: "POST",
    path: "/api/v1/messages/action/unmute",
    bodyFields: ["sessionId", "to"],
  },
  "chats:clearChat": {
    method: "DELETE",
    path: "/api/v1/messages/action/clear-all",
    bodyFields: ["sessionId", "to"],
  },

  // Message-level actions
  "messageAction:deleteMessage": {
    method: "DELETE",
    path: "/api/v1/messages/{messageId}/action/delete",
    pathParams: ["messageId"],
    bodyFields: ["sessionId", "to"],
  },
  "messageAction:editMessage": {
    method: "POST",
    path: "/api/v1/messages/{messageId}/action/edit",
    pathParams: ["messageId"],
    bodyFields: ["sessionId", "to", "message"],
  },
  "messageAction:markMessageRead": {
    method: "POST",
    path: "/api/v1/messages/{messageId}/action/mark-as-read",
    pathParams: ["messageId"],
    bodyFields: ["sessionId", "to"],
  },
  "messageAction:reactToMessage": {
    method: "POST",
    path: "/api/v1/messages/{messageId}/action/reaction",
    pathParams: ["messageId"],
    bodyFields: ["sessionId", "to", "emoji"],
  },
  "messageAction:removeReaction": {
    method: "POST",
    path: "/api/v1/messages/{messageId}/action/unreaction",
    pathParams: ["messageId"],
    bodyFields: ["sessionId", "to"],
  },
  "messageAction:revokeMessage": {
    method: "POST",
    path: "/api/v1/messages/{messageId}/action/revoke",
    pathParams: ["messageId"],
    bodyFields: ["sessionId", "to"],
  },
  "messageAction:starMessage": {
    method: "POST",
    path: "/api/v1/messages/{messageId}/action/star",
    pathParams: ["messageId"],
    bodyFields: ["sessionId", "to"],
  },
  "messageAction:unstarMessage": {
    method: "POST",
    path: "/api/v1/messages/{messageId}/action/unstar",
    pathParams: ["messageId"],
    bodyFields: ["sessionId", "to"],
  },

  // Groups
  "group:listGroups": {
    method: "GET",
    path: "/api/v1/groups",
    qsFields: ["sessionId"],
  },
  "group:getGroupInfo": {
    method: "GET",
    path: "/api/v1/group/info",
    qsFields: ["sessionId", "groupId"],
  },
  "group:getGroupInvite": {
    method: "GET",
    path: "/api/v1/group/invite",
    qsFields: ["sessionId", "groupId"],
  },
  "group:revokeGroupInvite": {
    method: "POST",
    path: "/api/v1/group/invite/revoke",
    bodyFields: ["sessionId", "groupId"],
  },
  "group:joinGroupByLink": {
    method: "POST",
    path: "/api/v1/group/join-via-link",
    bodyFields: ["sessionId", "inviteLink"],
  },
  "group:previewGroupByLink": {
    method: "GET",
    path: "/api/v1/group/join-via-link",
    qsFields: ["sessionId", "inviteLink"],
  },
  "group:createGroup": {
    method: "POST",
    path: "/api/v1/group/create",
    bodyFields: ["sessionId", "groupName", "participants"],
  },
  "group:leaveGroup": {
    method: "POST",
    path: "/api/v1/group/leave",
    bodyFields: ["sessionId", "groupId"],
  },
  "group:deleteGroup": {
    method: "DELETE",
    path: "/api/v1/group/delete",
    bodyFields: ["sessionId", "groupId"],
  },
  "group:updateGroupName": {
    method: "POST",
    path: "/api/v1/group/name",
    bodyFields: ["sessionId", "groupId", "groupName"],
  },
  "group:updateGroupDescription": {
    method: "POST",
    path: "/api/v1/group/description",
    bodyFields: ["sessionId", "groupId", "groupDescription"],
  },
  "group:setGroupAnnouncement": {
    method: "POST",
    path: "/api/v1/group/announcement",
    bodyFields: ["sessionId", "groupId", "announcement"],
  },
  "group:setGroupLocked": {
    method: "POST",
    path: "/api/v1/group/locked",
    bodyFields: ["sessionId", "groupId", "locked"],
  },
  "group:getGroupParticipants": {
    method: "GET",
    path: "/api/v1/group/participants",
    qsFields: ["sessionId", "groupId"],
  },
  "group:addGroupParticipants": {
    method: "POST",
    path: "/api/v1/group/participants/add",
    bodyFields: ["sessionId", "groupId", "participants"],
  },
  "group:removeGroupParticipants": {
    method: "DELETE",
    path: "/api/v1/group/participants/remove",
    bodyFields: ["sessionId", "groupId", "participants"],
  },
  "group:promoteGroupParticipants": {
    method: "POST",
    path: "/api/v1/group/participants/promote",
    bodyFields: ["sessionId", "groupId", "participants"],
  },
  "group:demoteGroupParticipants": {
    method: "POST",
    path: "/api/v1/group/participants/demote",
    bodyFields: ["sessionId", "groupId", "participants"],
  },
  "group:approveJoinRequest": {
    method: "POST",
    path: "/api/v1/group/participants/request/approve",
    bodyFields: ["sessionId", "groupId", "participants"],
  },
  "group:rejectJoinRequest": {
    method: "POST",
    path: "/api/v1/group/participants/request/reject",
    bodyFields: ["sessionId", "groupId", "participants"],
  },
  "group:listJoinRequests": {
    method: "GET",
    path: "/api/v1/group/participants/requests",
    qsFields: ["sessionId", "groupId"],
  },
  "group:getGroupPicture": {
    method: "GET",
    path: "/api/v1/group/picture",
    qsFields: ["sessionId", "groupId"],
  },
  "group:setGroupPicture": {
    method: "POST",
    path: "/api/v1/group/picture",
    bodyFields: ["sessionId", "groupId", "picture"],
  },
  "group:deleteGroupPicture": {
    method: "DELETE",
    path: "/api/v1/group/picture",
    bodyFields: ["sessionId", "groupId"],
  },

  // Profile
  "profile:getProfileInfo": {
    method: "GET",
    path: "/api/v1/profile/info",
    qsFields: ["sessionId"],
  },
  "profile:getProfilePicture": {
    method: "GET",
    path: "/api/v1/profile/picture",
    qsFields: ["sessionId"],
  },
  "profile:setProfilePicture": {
    method: "POST",
    path: "/api/v1/profile/picture",
    bodyFields: ["sessionId", "picture"],
  },
  "profile:deleteProfilePicture": {
    method: "DELETE",
    path: "/api/v1/profile/picture",
    bodyFields: ["sessionId"],
  },
  "profile:getPrivacySettings": {
    method: "GET",
    path: "/api/v1/profile/privacy",
    qsFields: ["sessionId"],
  },
  "profile:listContacts": {
    method: "GET",
    path: "/api/v1/profile/list-contacts",
    qsFields: ["sessionId"],
  },
  "profile:checkOnWhatsapp": {
    method: "GET",
    path: "/api/v1/profile/on-whatsapp",
    qsFields: ["sessionId", "checkNumbers"],
  },
  "profile:getBusinessProfile": {
    method: "GET",
    path: "/api/v1/profile/business-profile",
    qsFields: ["sessionId", "checkNumbers"],
  },

  // Misc
  "misc:convertStringToQr": {
    method: "POST",
    path: "/api/v1/misc/convert-string-toqr/{target}",
    pathParams: ["target"],
    bodyFields: ["string"],
  },
  "misc:base64": {
    method: "POST",
    path: "/api/v1/misc/base64",
    bodyFields: ["action", "input"],
  },
  "misc:cryptoHash": {
    method: "POST",
    path: "/api/v1/misc/crypto/hash",
    bodyFields: ["input"],
  },
  "misc:cryptoHmac": {
    method: "POST",
    path: "/api/v1/misc/crypto/hmac",
    bodyFields: ["key", "input"],
  },
  "misc:thumbnail": {
    method: "POST",
    path: "/api/v1/misc/media/thumbnail",
    bodyFields: ["file", "type"],
  },
  "misc:processImage": {
    method: "POST",
    path: "/api/v1/misc/media/image",
    bodyFields: ["file"],
  },
  "misc:uuidGenerate": {
    method: "POST",
    path: "/api/v1/misc/uuid/generate",
  },
  "misc:uuidValidate": {
    method: "POST",
    path: "/api/v1/misc/uuid/validate",
    bodyFields: ["value"],
  },
  "misc:decryptWhatsappFile": {
    method: "POST",
    path: "/api/v1/misc/whatsapp/file-decrypt",
    bodyFields: ["mediaKey", "file"],
  },
  "misc:decryptPollVote": {
    method: "POST",
    path: "/api/v1/misc/whatsapp/poll-update-vote",
    bodyFields: ["sessionId", "pollUpdateVote"],
  },
  "misc:validatePhone": {
    method: "POST",
    path: "/api/v1/misc/whatsapp/validate/phone",
    bodyFields: ["phone"],
  },
  "misc:validateJid": {
    method: "POST",
    path: "/api/v1/misc/whatsapp/validate/jid",
    bodyFields: ["jid"],
  },
  "misc:resolveJidOrLid": {
    method: "POST",
    path: "/api/v1/misc/whatsapp/resolve/jid-or-lid",
    bodyFields: ["input"],
  },
};

export class WARESTApi implements INodeType {
  description: INodeTypeDescription = {
    displayName: "WAREST",
    name: "warest",
    icon: "file:../icons/warest.png",
    group: ["input"],
    version: 1,
    subtitle: '={{$parameter["operation"]}}',
    description: "Interact with the WARest WhatsApp REST API",
    defaults: {
      name: "WAREST",
    },
    codex: {
      categories: ["Communication"],
      subcategories: {
        Communication: ["Messaging"],
      },
      alias: ["WAREST", "WA Rest", "WhatsApp"],
    },
    inputs: ["main"],
    outputs: ["main"],
    credentials: [
      {
        name: "warestApi",
        required: true,
      },
    ],
    properties,
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    for (let i = 0; i < items.length; i++) {
      try {
        const resource = this.getNodeParameter("resource", i) as Resource;
        const operation = this.getNodeParameter("operation", i) as string;
        const config = OPERATION_CONFIG[`${resource}:${operation}`];

        if (!config) {
          throw new NodeOperationError(
            this.getNode(),
            `Operation "${operation}" is not implemented yet`
          );
        }

        const credentials = await this.getCredentials("warestApi");
        const baseUrl = String(credentials.baseUrl || "").replace(/\/+$/, "");

        const qs: IDataObject = {};
        const body: IDataObject = {};
        const getParamValue = (field: string, fallback?: unknown) =>
          this.getNodeParameter(
            field,
            i,
            fallback,
            field === "sessionId" ? { extractValue: true } : undefined
          );

        let path = config.path;
        for (const param of config.pathParams ?? []) {
          const value = getParamValue(param);
          path = path.replace(`{${param}}`, encodeURIComponent(String(value)));
        }

        for (const field of config.qsFields ?? []) {
          const value = getParamValue(field, null);
          setIfDefined(qs, field, value);
        }

        for (const field of config.bodyFields ?? []) {
          const value = getParamValue(field, null);
          setIfDefined(body, field, value);
        }

        const additionalName = ADDITIONAL_FIELD_NAME[resource];
        const additionalRaw =
          (additionalName
            ? (this.getNodeParameter(additionalName, i, {}) as IDataObject)
            : {}) ?? {};
        const additionalFields = flattenFixedCollection(additionalRaw);

        if (config.preprocess) {
          config.preprocess.call(this, body, qs, i);
        }

        if (
          resource === "misc" &&
          ["cryptoHash", "cryptoHmac"].includes(operation) &&
          additionalFields.cryptoOutput
        ) {
          additionalFields.output = additionalFields.cryptoOutput;
          delete additionalFields.cryptoOutput;
        }

        if (
          Object.keys(additionalFields).length > 0 &&
          !config.sendAdditionalTo &&
          config.method === "GET"
        ) {
          Object.assign(qs, additionalFields);
        } else if (Object.keys(additionalFields).length > 0) {
          if (config.sendAdditionalTo === "query") {
            Object.assign(qs, additionalFields);
          } else {
            Object.assign(body, additionalFields);
          }
        }

        if (resource === "messages") {
          const optionFields = MESSAGE_OPTION_FIELDS[operation] ?? [];
          for (const field of optionFields) {
            const value = getParamValue(field, null);
            setIfDefined(body, field, value);
          }

          if (
            [
              "sendMedia",
              "sendDocument",
              "sendAudio",
              "sendGif",
              "sendSticker",
            ].includes(operation)
          ) {
            const binaryMode = getParamValue(
              `${operation.replace("send", "").toLowerCase()}BinaryMode`,
              false
            ) as boolean;
            if (binaryMode && binarySourceConfig[operation]) {
              const configEntry = binarySourceConfig[operation];
              const binaryProp = getParamValue(
                configEntry.binaryParam,
                undefined
              ) as string | undefined;
              if (typeof binaryProp === "string" && binaryProp.trim()) {
                const dataUri = await getBinaryAsDataUri.call(
                  this,
                  i,
                  binaryProp.trim()
                );
                body[configEntry.field] = dataUri;
              }
            }
          }
        }

        if (operation === "sendButton") {
          const buttons = normalizeCollection(
            this.getNodeParameter("buttons", i, []),
            "button"
          )
            .map((entry) => sanitize(entry))
            .filter(
              (entry) =>
                typeof entry.displayText === "string" &&
                entry.displayText.trim() !== ""
            );
          if (buttons.length === 0) {
            throw new NodeOperationError(
              this.getNode(),
              "Add at least one button with a title",
              { itemIndex: i }
            );
          }
          body.buttons = buttons;
        }

        if (operation === "sendList") {
          const listPayload = buildListPayload(this, i);
          const sections = (listPayload.sections as IDataObject[]) ?? [];
          if (sections.length === 0) {
            throw new NodeOperationError(
              this.getNode(),
              "Add at least one section with at least one row for list messages",
              { itemIndex: i }
            );
          }
          body.list = listPayload;
        }

        if (operation === "sendLocation") {
          body.location = buildLocationPayload(this, i);
          if (!body.location) {
            throw new NodeOperationError(
              this.getNode(),
              "Latitude and longitude are required"
            );
          }
        }

        if (operation === "sendPoll") {
          const options = buildStringArray(
            this.getNodeParameter("options.option", i, [])
          );
          if (!options?.length) {
            throw new NodeOperationError(
              this.getNode(),
              "Add at least one poll option",
              { itemIndex: i }
            );
          }
          body.options = options;
        }

        if (operation === "sendContact") {
          body.contact = buildContactPayload(this, i);
        }

        if (binarySourceConfig[operation]) {
          const configEntry = binarySourceConfig[operation];
          const binaryProp = getParamValue(
            configEntry.binaryParam,
            undefined
          ) as string | undefined;
          if (typeof binaryProp === "string" && binaryProp.trim()) {
            const dataUri = await getBinaryAsDataUri.call(
              this,
              i,
              binaryProp.trim()
            );
            body[configEntry.field] = dataUri;
          }
        }

        if (operation === "sendFiles") {
          const files =
            (this.getNodeParameter(
              "files.fileEntry",
              i,
              []
            ) as IDataObject[]) || [];
          const converted: IDataObject[] = [];
          for (const entry of files) {
            const binaryMode = entry.binaryFile === true;
            if (binaryMode) {
              const binaryProp =
                (entry.binaryProperty as string) &&
                String(entry.binaryProperty);
              const dataUri = await getBinaryAsDataUri.call(
                this,
                i,
                binaryProp || "data"
              );
              const cloned: IDataObject = { ...entry, file: dataUri };
              delete cloned.mode;
              delete cloned.binaryProperty;
              converted.push(cloned);
            } else {
              const cloned: IDataObject = { ...entry };
              delete cloned.binaryFile;
              delete cloned.binaryProperty;
              converted.push(cloned);
            }
          }
          body.files = converted;
        }

        if (
          [
            "addGroupParticipants",
            "removeGroupParticipants",
            "promoteGroupParticipants",
            "demoteGroupParticipants",
            "approveJoinRequest",
            "rejectJoinRequest",
            "createGroup",
          ].includes(operation)
        ) {
          const participants = buildStringArray(
            this.getNodeParameter("participants.participant", i, [])
          );
          if (!participants?.length) {
            throw new NodeOperationError(
              this.getNode(),
              "Add at least one participant",
              { itemIndex: i }
            );
          }
          body.participants = participants;
        }

        if (
          operation === "muteChat" &&
          additionalFields.duration !== undefined
        ) {
          body.duration = additionalFields.duration;
        }

        if (resource === "misc" && operation === "processImage") {
          const actions = buildImageActions(additionalFields);
          if (actions) {
            body.actions = actions;
          }
          delete body.convert;
          delete body.resizeWidth;
          delete body.resizeHeight;
          delete body.fit;
          delete body.quality;
        }

        if (resource === "misc" && operation === "decryptPollVote") {
          Object.assign(body, additionalFields);
        }

        const requestOptions: IDataObject = {
          method: config.method,
          url: `${baseUrl}${path}`,
          qs,
          json: true,
        };

        if (config.method !== "GET") {
          requestOptions.body = body;
        }

        const response = await this.helpers.requestWithAuthentication.call(
          this,
          "warestApi",
          requestOptions
        );

        const results = response?.results ?? response;
        if (Array.isArray(results)) {
          for (const entry of results) {
            returnData.push({ json: entry as IDataObject });
          }
        } else {
          returnData.push({ json: results as IDataObject });
        }
      } catch (error) {
        if (this.continueOnFail()) {
          returnData.push({
            json: {
              error: (error as Error).message,
            },
          });
          continue;
        }
        throw error;
      }
    }

    return [returnData];
  }

  methods = {
    loadOptions: {
      async getSessions(this: ILoadOptionsFunctions) {
        return loadSessionOptions.call(this);
      },
    },
    listSearch: {
      async searchSessions(
        this: ILoadOptionsFunctions,
        filter?: string
      ): Promise<INodeListSearchResult> {
        const sessions = await loadSessionOptions.call(this);
        const normalizedFilter = filter?.toLowerCase().trim();
        const results = normalizedFilter
          ? sessions.filter((session) => {
              const name = session.name?.toString().toLowerCase() ?? "";
              const value = session.value?.toString().toLowerCase() ?? "";
              return (
                name.includes(normalizedFilter) ||
                value.includes(normalizedFilter)
              );
            })
          : sessions;
        return { results };
      },
    },
  };
}

async function loadSessionOptions(
  this: ILoadOptionsFunctions
): Promise<INodePropertyOptions[]> {
  try {
    const credentials = await this.getCredentials("warestApi");
    if (!credentials?.baseUrl || !credentials?.apiKey) {
      return [];
    }
    const baseURL = String(credentials.baseUrl || "").replace(/\/+$/, "");
    const response = await this.helpers.requestWithAuthentication.call(
      this,
      "warestApi",
      {
        method: "GET",
        baseURL,
        url: "/api/v1/session/list",
        json: true,
      }
    );

    const flattened: IDataObject[] = [];
    const collect = (value: unknown) => {
      if (!value) return;
      if (Array.isArray(value)) {
        for (const entry of value) {
          if (entry && typeof entry === "object") {
            const items = (entry as IDataObject).items;
            if (Array.isArray(items)) {
              flattened.push(...(items as IDataObject[]));
            } else {
              flattened.push(entry as IDataObject);
            }
          }
        }
      } else if (typeof value === "object") {
        const items = (value as IDataObject).items;
        if (Array.isArray(items)) {
          flattened.push(...(items as IDataObject[]));
        }
      }
    };

    collect((response as IDataObject)?.results);
    collect((response as IDataObject)?.items);
    if (flattened.length === 0) {
      collect(response);
    }

    return flattened
      .filter(
        (s) => typeof s === "object" && s !== null && (s as IDataObject).id
      )
      .map((s) => {
        const friendlyName =
          typeof (s as IDataObject).name === "string"
            ? String((s as IDataObject).name)
            : undefined;
        const pushName =
          typeof (s as IDataObject).pushName === "string"
            ? String((s as IDataObject).pushName)
            : undefined;
        const meName =
          typeof (s as IDataObject).me === "object" && s.me
            ? (s.me as IDataObject).name
            : undefined;
        const label =
          friendlyName || (pushName as string) || (meName as string);
        return {
          name: `${(s.id as string) ?? ""} (${(s.status as string) ?? "-"})`,
          value: String(s.id ?? ""),
          description: typeof label === "string" ? label : undefined,
        };
      });
  } catch {
    // On failure, return empty to avoid breaking the UI and let manual entry work
    return [];
  }
}

function setIfDefined(target: IDataObject, key: string, value: unknown) {
  if (value === undefined || value === null) return;
  if (typeof value === "string" && value === "") return;
  target[key] = value as IDataObject;
}

function sanitize(input: IDataObject): IDataObject {
  const clean: IDataObject = {};
  for (const [key, value] of Object.entries(input ?? {})) {
    if (value === undefined || value === null) continue;
    if (typeof value === "string" && value === "") continue;
    clean[key] = value as IDataObject;
  }
  return clean;
}

function flattenFixedCollection(input: IDataObject): IDataObject {
  const flattened: IDataObject = {};
  for (const value of Object.values(input ?? {})) {
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (entry && typeof entry === "object") {
          Object.assign(flattened, sanitize(entry as IDataObject));
        }
      }
    } else if (value && typeof value === "object") {
      Object.assign(flattened, sanitize(value as IDataObject));
    }
  }
  return flattened;
}

function buildStringArray(value: unknown): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) {
    const normalized = value
      .map((entry) => {
        if (typeof entry === "string") return entry.trim();
        if (typeof entry === "object" && entry !== null) {
          const record = entry as IDataObject;
          const candidate =
            (record.value as string) ??
            (record.id as string) ??
            (record.title as string);
          return typeof candidate === "string" ? candidate.trim() : undefined;
        }
        return undefined;
      })
      .filter(
        (entry): entry is string =>
          typeof entry === "string" && entry.length > 0
      );
    return normalized.length > 0 ? normalized : undefined;
  }
  if (typeof value === "string") {
    const entries = value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
    return entries.length > 0 ? entries : undefined;
  }
  return undefined;
}

function normalizeCollection(
  value: unknown,
  nestedKey?: string
): IDataObject[] {
  if (Array.isArray(value)) {
    return value as IDataObject[];
  }
  if (nestedKey && value && typeof value === "object") {
    const nested = (value as IDataObject)[nestedKey];
    if (Array.isArray(nested)) {
      return nested as IDataObject[];
    }
  }
  return [];
}

function buildListPayload(
  ctx: IExecuteFunctions,
  itemIndex: number
): IDataObject {
  const getOptional = (name: string) => {
    try {
      return ctx.getNodeParameter(name, itemIndex, null);
    } catch {
      return undefined;
    }
  };

  const sectionsRaw = normalizeCollection(
    ctx.getNodeParameter("listSections", itemIndex, []),
    "section"
  );
  const sections =
    sectionsRaw?.map((section) => {
      const rowsRaw = normalizeCollection(section.rows, "row");
      const rows =
        rowsRaw
          ?.map((row) => ({
            id: row.id,
            title: row.title,
            description: row.description,
            header: row.header,
          }))
          .filter(
            (row) =>
              typeof row.id === "string" &&
              row.id.trim() !== "" &&
              typeof row.title === "string" &&
              row.title.trim() !== ""
          ) ?? [];
      return {
        title: section.title,
        rows,
      };
    }) ?? [];
  const filteredSections = sections.filter(
    (section) => (section.rows?.length ?? 0) > 0
  );

  const list: IDataObject = {
    buttonText: ctx.getNodeParameter("listButtonText", itemIndex) as string,
  };

  if (filteredSections.length > 0) {
    list.sections = filteredSections;
  }

  const image = getOptional("image");
  if (typeof image === "string" && image) {
    list.image = image;
  }

  return list;
}

function buildLocationPayload(
  ctx: IExecuteFunctions,
  itemIndex: number
): IDataObject | undefined {
  const location = ctx.getNodeParameter(
    "location",
    itemIndex,
    {}
  ) as IDataObject;
  const coordinates = (location.coordinates ?? location) as IDataObject;
  const latitude = coordinates.latitude as number | undefined;
  const longitude = coordinates.longitude as number | undefined;
  if (latitude === undefined || longitude === undefined) {
    return undefined;
  }
  const payload: IDataObject = { latitude, longitude };
  setIfDefined(payload, "name", coordinates.name);
  setIfDefined(payload, "address", coordinates.address);
  return payload;
}

function buildContactPayload(
  ctx: IExecuteFunctions,
  itemIndex: number
): IDataObject | undefined {
  const contact = ctx.getNodeParameter("contact", itemIndex, {}) as IDataObject;
  const fields = (contact.contactFields ?? contact) as IDataObject;
  return sanitize(fields);
}

function buildImageActions(additional: IDataObject): IDataObject | undefined {
  const actions: IDataObject = {};
  const resize: IDataObject = {};

  if (additional.resizeWidth) {
    resize.width = additional.resizeWidth;
  }
  if (additional.resizeHeight) {
    resize.height = additional.resizeHeight;
  }
  if (additional.fit) {
    resize.fit = additional.fit;
  }
  if (Object.keys(resize).length > 0) {
    actions.resize = resize;
  }

  if (additional.convert) {
    actions.convert = additional.convert;
  }

  if (additional.quality) {
    actions.compress = { quality: additional.quality };
  }

  return Object.keys(actions).length > 0 ? actions : undefined;
}

async function getBinaryAsDataUri(
  this: IExecuteFunctions,
  itemIndex: number,
  propertyName: string
): Promise<string> {
  const buffer = await this.helpers.getBinaryDataBuffer(
    itemIndex,
    propertyName
  );
  const item = this.getInputData()[itemIndex];
  const mimeType =
    item.binary?.[propertyName]?.mimeType || "application/octet-stream";
  const base64 = buffer.toString("base64");
  return `data:${mimeType};base64,${base64}`;
}
