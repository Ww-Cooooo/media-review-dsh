import {ReviewStore as BaseReviewStore} from '../src/store.mjs';

// Explicit test tools keep a clean checkout independent of personal settings.
export class ReviewStore extends BaseReviewStore {
  constructor(directory,host,options={}) {
    super(directory,host,{ffprobe:process.env.MR_TEST_FFPROBE||'ffprobe',...options});
    this.toolOverrides=()=>({
      ffmpeg:process.env.MR_TEST_FFMPEG||'ffmpeg',
      whisper:process.env.MR_TEST_WHISPER,
      model:process.env.MR_TEST_MODEL,
    });
  }
}
