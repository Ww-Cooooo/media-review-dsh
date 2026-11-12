/** Persisted installation receipt shared by both callers. */
export interface ConnectionReceipt {
  schemaVersion: number;
  installedAt: string;
  service: string;
  phase: string;
  persisted: boolean;
}
/** Structured test input, used only by the first integration milestone. */
export interface ProbeRequest { operationId: string; notes: { id: string; text: string }[] }
/** Structured response confirms the generated Remote codec preserved nested values. */
export interface ProbeReceipt { operationId: string; notes: { id: string; text: string }[]; accepted: boolean }
export interface Rect { x:number; y:number; width:number; height:number }
export interface Reference { frameMs:number; fileName:string; width:number; height:number;origin?:{taskId:string;version:number;durationMs:number} }
export interface Region {id:number;rect:Rect;text?:string}
export interface Note { id:string;kind:'modify'|'keep'|'discuss';startMs:number|null;endMs:number|null;text:string;rect?:Rect|null;regions?:Region[];regionSerial?:number;topic?:'visual'|'subtitle'|'audio'|'pace'|'content'|'other'|null;scope?:'whole';reference?:Reference|null;priority?:'normal'|'high' }
export interface Mapping { noteId:string;startMs:number;endMs:number|null }
export interface Target { id:string;title:string;path:string;sessions:{id:string;title:string}[] }
export interface Media { name:string;size:number;type:string;durationMs:number;fingerprint:string;mtimeMs?:number }
export interface MediaTask { manualVersion?:boolean;id:string;title:string;version:number;workId:string;previousTaskId:string|null;media:Media;workspaceId:string;sessionId:string;mappings:Mapping[];mappingRevision:string;archivedAt?:string|null;status:string;createdAt:string;lastOpenedAt:string|null;label:string;streams:{codec_type:string;codec_name:string;width?:number;height?:number}[] }
export interface Round { id:string;taskId:string;revision:string;workspaceId:string;sessionId:string;priorities:Record<string,string>;scope:string;requestId:string;number:number;hash:string;state:string;createdAt:string;targetTaskId:string|null;error:string|null;deliveredAt?:string;acceptedAt?:string;returnedAt?:string }
export interface ProgressEvent { id:string;roundId?:string|null;operationId?:string|null;noteId:string;recordRevision:string;noteRevision:string;status:string;text:string;targetTaskId:string|null;targetMs:number|null;actor:string;at:string }
export interface Playback {timeMs:number;volume:number;rate:number}
export interface Completion {outcome:'no-changes'|'with-notes';completedAt:string}
export interface Board { targets:Target[];tasks:MediaTask[];draft:{notes:Note[];revision:string;completion?:Completion|null}|null;rounds:Round[];items:{note:Note;latest:ProgressEvent|null;history:ProgressEvent[]}[];preferences:Playback|null;nextRoundNumber:number }
export interface BoardQuery {workspaceId:string;taskId?:string;roundId?:string}
export interface ConversationQuery {sessionId:string}
export interface ConversationEntry {id:string;title:string;workspaceId:string;taskId:string;viewTaskId:string;roundId:string|null}
export interface ConversationReview {sessionId:string;workspaceId:string;cursor:string;entries:ConversationEntry[]}
export interface Registration {operationId:string;workspaceId:string;sessionId:string;source:string;title:string;allowedRoot?:string;previousTaskId?:string|null;roundId?:string|null;mappings?:Mapping[];manualReview?:boolean;manualMetadata?:ManualMetadata}
export interface DraftRequest {operationId:string;workspaceId:string;taskId:string;expectedRevision:string;notes:Note[];noChanges?:boolean;clientId?:string}
export interface SaveReceipt {revision:string;savedAt:string}
export interface FreezeRequest {operationId:string;workspaceId:string;taskId:string;sessionId:string;expectedRevision:string;scope:string}
export interface RoundRequest {workspaceId:string;roundId:string}
export interface CancellationRequest extends RoundRequest {stopSession?:boolean}
export interface MappingRequest extends Mapping {operationId:string;workspaceId:string;taskId:string;roundId:string;expectedRevision:string}
export interface CarryRequest extends RoundRequest {operationId:string;targetTaskId:string;expectedRevision:string}
export interface CarryReceipt extends SaveReceipt {taskId:string;count:number;nextRoundNumber:number}
export interface UserReviewRequest {operationId:string;workspaceId:string;roundId:string;noteId:string;targetTaskId:string;resolved:boolean;text:string;targetMs?:number|null}
export interface ManualProgressRequest {operationId:string;workspaceId:string;roundId:string;noteId:string;targetTaskId:string;text:string;targetMs?:number|null}
export interface ReferenceRequest {workspaceId:string;taskId:string;frameMs:number;data:string}
export interface PlaybackRequest extends Playback {workspaceId:string;taskId:string}
export interface Recorded {recorded:boolean}
export interface Saved {saved:boolean}
export interface Configuration {dataDirectory:string;ffprobe:string;ffmpeg:string;whisper:string;model:string}
export interface ConfigurationRequest {ffprobe:string;ffmpeg?:string;whisper?:string;model?:string}
export interface BrowseRequest {workspaceId:string;directory?:string}
export interface BrowseResult {directory:string;parent:string|null;entries:{name:string;path:string;directory:boolean}[];limited:boolean}
export interface AnalysisRequest {workspaceId:string;taskId:string;action:'status'|'waveform'|'transcribe'|'cancel'|'import';text?:string;fileName?:string}
export interface Cue {id:string;startMs:number;endMs:number;text:string}
export interface AnalysisResult {state:string;phase:string;peaks:number[];cues:Cue[];waveError:string;transcriptError:string;source:string;durationMs:number;fileName?:string;startedAt?:string;updatedAt?:string;progress?:number|null}
export interface OrganizeRequest {workspaceId:string;taskId:string;action:'rename'|'archive'|'restore'|'opened'|'close'|'reopen';title?:string}
export interface ExportRequest {workspaceId:string;taskId:string;roundId?:string}
export interface ExportReceipt {id:string;name:string;directory:string;path:string}
export interface EditorRequest {workspaceId:string;taskId:string;clientId:string;action:'claim'|'heartbeat'|'takeover'|'release'}
export interface EditorReceipt {editable:boolean;expiresAt:string|null}
export interface RecoveryRequest {workspaceId:string;taskId:string;clientId:string;action:'list'|'backup'|'archive'|'clear';notes?:Note[];expectedRevision?:string}
export interface RecoveryItem {id:string;kind:string;notes:Note[];expectedRevision:string;savedAt:string}
export interface RecoveryReceipt {items:RecoveryItem[]}
export interface LocationsRequest {workspaceId:string;taskId:string;open?:string}
export interface Locations {items:{kind:string;label:string;path:string}[]}
export interface RelinkRequest {workspaceId:string;taskId:string;clientId:string;operationId:string;source:string}
export interface ToolStatus {name:string;path:string;ready:boolean;detail:string}
export interface Readiness {version:string;tools:ToolStatus[];dataDirectory:string}
export interface PreparationRequest {action:'status'|'prepare'|'cancel';verify?:boolean}
export interface PreparationResult {state:string;phase:string;error:string;reused:string[];prepared:string[];verified:boolean;verificationReused:boolean;downloadedBytes:number}
export interface Activity {taskId:string;title:string;state:string;phase:string;startedAt?:string;updatedAt?:string}
export interface ActivityQuery {workspaceId:string}
export interface Activities {items:Activity[]}
export interface InspectionRequest {workspaceId:string;taskId:string;action:'start'|'status'|'cancel';points?:number[]}
export interface InspectionFrame {file:string;timeMs:number}
export interface InspectionResult {state:string;phase:string;startedAt:string|null;updatedAt:string|null;error:string;decoded:boolean;black:{startMs:number;endMs:number}[];silence:{startMs:number;endMs:number}[];frames:InspectionFrame[];findings:string[]}
export interface Coverage {startMs:number;endMs:number;aspects:string[];result:string;detail:string}
export interface KeptNote {taskId:string;recordRevision:string;noteId:string;result:string;detail:string}
export interface CheckReport {id:string;origin:string;userApproved:boolean;coverage:Coverage[];keptNotes:KeptNote[];findings:string;notVerified:string;at:string}
export interface CheckQuery {workspaceId:string;taskId:string}
export interface CheckReports {items:CheckReport[]}
export interface HandoffReceipt {text:string}

export interface ManualMetadata {durationMs:number;size:number;sha256:string;width:number;height:number}
