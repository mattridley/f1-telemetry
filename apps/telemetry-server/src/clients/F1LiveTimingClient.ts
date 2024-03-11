import {type Data, WebSocket} from "ws";

import {z} from "zod";

// TODO: Find a way o import from Websocket

interface Event {
    type: string;
    target: WebSocket;
}

interface ErrorEvent {
    error: any;
    message: string;
    type: string;
    target: WebSocket;
}

interface CloseEvent {
    wasClean: boolean;
    code: number;
    reason: string;
    type: string;
    target: WebSocket;
}

interface MessageEvent {
    data: Data;
    type: string;
    target: WebSocket;
}

interface EventListenerOptions {
    once?: boolean | undefined;
}

interface F1LiveTimingClientOptions {
    hostname?: string;
    basePath?: string;
    hub?: string;
}

type EventListener = { method: 'open', cb: (event: Event) => void, options?: EventListenerOptions } |
    { method: 'close', cb: (event: CloseEvent) => void, options?: EventListenerOptions } |
    { method: 'message', cb: (event: MessageEvent) => void, options?: EventListenerOptions } |
    { method: 'error', cb: (event: ErrorEvent) => void, options?: EventListenerOptions };

const NegotiateResponseBodySchema = z.object({ConnectionToken: z.string()});

const SUPPORTED_TOPICS = ["Heartbeat", "CarData.z", "Position.z", "ExtrapolatedClock", "TopThree", "RcmSeries",
    "TimingStats", "TimingAppData", "WeatherData", "TrackStatus", "DriverList", "RaceControlMessages", "SessionInfo",
    "SessionData", "LapCount", "TimingData"] as const
const SupportedTopicEnum = z.enum(SUPPORTED_TOPICS);
const SupportedTopicArraySchema = z.array(SupportedTopicEnum);

// TODO: Extract generic ASP.NET SignalR client
export class F1LiveTimingClient {
    #socket: WebSocket | undefined;

    #eventListeners: EventListener[] = [];

    hostname = 'livetiming.formula1.com';

    basePath = '/signalr';

    clientProtocol = '1.5';

    hub: string;

    static SUPPORTED_TOPICS = SUPPORTED_TOPICS;

    constructor({hostname, basePath, hub = 'Streaming'}: F1LiveTimingClientOptions = {}) {
        if (hostname) {
            this.hostname = hostname;
        }

        if (basePath) {
            this.basePath = basePath;
        }

        this.hub = hub;
    }

    async connect() {
        const {data, cookie} = await this.#negotiate();

        const params = this.#getConnectionParams({
            transport: 'webSockets',
            connectionToken: data.ConnectionToken
        });
        const url = new URL(`${this.basePath}/connect?${params}`, `wss://${this.hostname}`)

        return new Promise<void>((resolve) => {
            const socket = new WebSocket(url, {headers: {'Cookie': cookie}})
            socket.addEventListener('open', () => {
                this.#socket = socket;
                this.#addEventListeners();
                resolve();
            });

            socket.addEventListener('close', () => {
                this.#socket = undefined;
            });
        });
    }

    subscribe(topics = F1LiveTimingClient.SUPPORTED_TOPICS) {
        if (!this.#socket) throw new Error('Cannot subscribe as no socket connected');
        SupportedTopicArraySchema.parse(topics);

        this.#socket.send(JSON.stringify(
            {
                "H": this.hub,
                "M": 'Subscribe',
                "A": [topics],
                "I": 1
            }
        ));
    }

    addMessageListener(cb: (eve: MessageEvent) => void, options?: EventListenerOptions) {
        this.#eventListeners.push({method: 'message', cb, options});

        if (this.#socket) {
            this.#socket.addEventListener('message', cb, options);
        }
    }

    addErrorListener(cb: (eve: ErrorEvent) => void, options?: EventListenerOptions) {
        this.#eventListeners.push({method: 'error', cb, options});

        if (this.#socket) {
            this.#socket.addEventListener('error', cb, options);
        }
    }

    #addEventListeners() {
        if (!this.#socket) throw new Error('Cannot add listeners as no socket is connected');
        for (const listener of this.#eventListeners) {
            // TODO: Figure out how to not require this poinless switch statement
            switch (listener.method) {
                case 'open':
                    this.#socket.addEventListener('open', listener.cb, listener.options);
                    break;
                case 'close':
                    this.#socket.addEventListener('close', listener.cb, listener.options);
                    break;
                case 'message':
                    this.#socket.addEventListener('message', listener.cb, listener.options);
                    break;
                case 'error':
                    this.#socket.addEventListener('error', listener.cb, listener.options);
                    break;
            }
        }
    }

    async #negotiate() {
        // TODO: Understand why using URL here results in a type error
        const response = await fetch(`https://${this.hostname}/${this.basePath}/negotiate?${this.#getConnectionParams()}`);

        if (!response.ok) {
            throw new Error(`Unable to negotiate live timing credentials`, {cause: await response.text()});
        }

        try {
            const responseBody = await response.json();
            const data = NegotiateResponseBodySchema.parse(responseBody);
            const cookie = response.headers.get('set-cookie');

            if (!cookie) throw new Error('Cookie not found')

            return {
                data,
                cookie
            }
        } catch (err) {
            throw new Error('Failed to parse negotiation response', {cause: err});
        }
    }

    #getConnectionParams(additionalParams?: Record<string, string | readonly string[]>) {
        return new URLSearchParams({
            clientProtocol: this.clientProtocol,
            connectionData: JSON.stringify([{name: this.hub}]),
            ...additionalParams
        })
    }
}