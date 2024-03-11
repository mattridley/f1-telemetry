import {appendFile} from "node:fs";
import {F1LiveTimingClient} from "./clients/F1LiveTimingClient.ts";

const client = new F1LiveTimingClient();

await client.connect();
client.addMessageListener((data) => {
    console.log('D: ', data.data);
    appendFile('saudi.log', data.data.toString() + '\n', err => {
        if (err) console.log('Failed to log data:', err)
    });
});
client.addErrorListener((data) => {
    console.log('D: ', data.error);
    appendFile('saudi.error.log', data.message + '\n', err => {
        if (err) console.log('Failed to log data:', err)
    });
});
client.subscribe();