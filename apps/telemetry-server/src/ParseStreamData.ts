import {z} from 'zod';

import {readFileLineByLine} from "./utils/readFileLneStream.ts";

const SectorSegmentTimingData = z.record(z.object({
    Status: z.number().optional()
}));

const SectorsTimingDataSchema = z.record(z.object({
    Value: z.string().optional(),
    PersonalFastest: z.boolean().optional(),
    PreviousValue: z.string().optional(),
    Segments: SectorSegmentTimingData.optional()
}));

const TimingDataSchema = z.object({
    Lines: z.record(z.object({
        GapToLeader: z.string().optional(),
        IntervalToPositionAhead: z.object({
            Value: z.string().optional(),
            Catching: z.boolean().optional()
        }).optional(),
        Sectors: SectorsTimingDataSchema.optional()
    }))
});
type TimingData = z.infer<typeof TimingDataSchema>;

function parseTimingData(data: TimingData) {
    try {
        const timingData = TimingDataSchema.parse(data);
        return timingData.Lines;
    } catch (error) {
        console.error('ERR', error, data);
        return {}
    }
}

readFileLineByLine('saudi.log', line => {
    try {
        const data = JSON.parse(line ?? '{}');

        if ('M' in data && Array.isArray(data.M)) {
            for (const {A: attributes} of data.M) {
                const [topic, args, timestamp] = attributes

                switch (topic) {
                    case 'TimingData':
                        const timingData = parseTimingData(args);
                        if (args['Lines']['23']) {
                            console.log(`${new Date(Date.parse(timestamp)).toISOString()} [${topic} Car ]: ${JSON.stringify(timingData['23'])}`);
                        }
                        break;
                    default:
                        // TODO: Log error once everything supported
                        break;
                }
            }
        }
    } catch (err) {
        console.error(err);
    }
})