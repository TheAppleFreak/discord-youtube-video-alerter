import env from "env-var";
import axios, { isCancel, AxiosError } from "axios";
import Parser from "rss-parser";
import { consola } from "consola";

consola.wrapAll();
const parser = new Parser();

// @ts-expect-error
const CHANNEL_ID = env
    .get("YOUTUBE_CHANNEL_ID")
    .required()
    .asString()
    .match(/^(?:UC)?(\w+)$/)[1];
const CONTENT_TYPE = env
    .get("YOUTUBE_CONTENT_TYPE")
    .default("video")
    .asEnum([
        "video",
        "videos",
        "popularVideos",
        "live",
        "streams",
        "memberVideo",
        "memberVideos",
        "memberAllTypes",
        "memberShorts",
        "memberLive",
        "memberStreams",
        "popularShorts",
        "popularLive",
        "popularStreams",
        "shorts"
    ]);
const DISCORD_WEBHOOK = env.get("DISCORD_WEBHOOK").required().asUrlString();
const UPDATE_INTERVAL = env.get("UPDATE_INTERVAL").default("120").asIntPositive();

// Determine RSS prefix for specified content type
// https://stackoverflow.com/questions/71192605/how-do-i-get-youtube-shorts-from-youtube-api-data-v3/76602819#76602819
let CONTENT_PREFIX: string;
switch (CONTENT_TYPE) {
    case "video":
    case "videos":
        CONTENT_PREFIX = "UULF";
        break;
    case "popularVideos":
        CONTENT_PREFIX = "UULP";
        break;
    case "live":
    case "streams":
        CONTENT_PREFIX = "UULV";
        break;
    case "memberVideo":
    case "memberVideos":
        CONTENT_PREFIX = "UUMF";
        break;
    case "memberAllTypes":
        CONTENT_PREFIX = "UUMO";
        break;
    case "memberShorts":
        CONTENT_PREFIX = "UUMS";
        break;
    case "memberLive":
    case "memberStreams":
        CONTENT_PREFIX = "UUMV";
        break;
    case "popularShorts":
        CONTENT_PREFIX = "UUPS";
        break;
    case "popularLive":
    case "popularStreams":
        CONTENT_PREFIX = "UUPV";
        break;
    case "shorts":
        CONTENT_PREFIX = "UUSH";
        break;
    default:
        consola.error(
            new Error(
                "You somehow supplied an invalid content type that passsed validation: " +
                    CONTENT_TYPE
            )
        );
        break;
}

let lastUploadedTime: number =
    env.get("DEBUG_DATE").asString() === undefined
        ? new Date().getTime()
        : new Date(env.get("DEBUG_DATE").asString()!).getTime();

const checkForVideos = async () => {
    // The RSS feed is newest-first, so we reverse it to ensure we're not setting lastUploadedTime incorrectly
    const feed = (
        await parser.parseURL(
            `https://www.youtube.com/feeds/videos.xml?playlist_id=${CONTENT_PREFIX}${CHANNEL_ID}`
        )
    ).items.reverse();

    let videoPosted = false;

    // We're doing this as a for loop to avoid async-related races
    for (let i = 0; i < feed.length; i++) {
        const video = feed[i];

        const uploadDate = new Date(video.isoDate!).getTime();
        if (uploadDate <= lastUploadedTime) {
            continue;
        };
        lastUploadedTime = uploadDate;
        videoPosted = true;

        await axios.post(DISCORD_WEBHOOK, {
            content: `# [${video.title}](${video.link})`
        });
    }

    if (videoPosted) consola.log(`Posted new video on ${new Date().toDateString()} at ${new Date().toTimeString()}`);
};

checkForVideos();

setInterval(checkForVideos, UPDATE_INTERVAL * 1000);
