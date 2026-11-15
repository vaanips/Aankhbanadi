import { AssistantResponse, ParsedIntent } from '../../core/types/assistant.types';
import { DetectionQueryResult } from '../../core/types/detection.types';
import { APP_NAME, DEMO_MODE } from '../../core/utils/constants';
import { formatStepsText } from '../../core/utils/formatters';
import { DetectionGroupingService } from '../detection/DetectionGroupingService';
import { VerbosityLevel } from '../../core/state/settingsStore';

export interface ResponseGeneratorOptions {
  demoMode?: boolean;
  verbosity?: VerbosityLevel;
}

function demoPrefix(options: ResponseGeneratorOptions): string {
  if (!(options.demoMode ?? DEMO_MODE)) {
    return '';
  }
  return 'In demo mode, using sample scene data, not live vision. ';
}

function helpText(): string {
  return [
    `I am ${APP_NAME}. You can say start or stop camera,`,
    'what can you see, what is in front, anything on the left or right,',
    'is there a person nearby, anything within five steps,',
    'start or stop announcements, open settings, or go home.',
  ].join(' ');
}

function yesNoResponse(
  question: string | undefined,
  answer: boolean,
  detail: string,
  options: ResponseGeneratorOptions,
): string {
  const prefix = demoPrefix(options);
  const lead = question ? '' : '';
  void lead;
  const yesNo = answer ? 'Yes' : 'No';
  if (detail) {
    return `${prefix}${yesNo}. ${detail}`;
  }
  return `${prefix}${yesNo}`;
}

export function generateResponse(
  intent: ParsedIntent,
  query: DetectionQueryResult | null,
  options: ResponseGeneratorOptions = {},
): AssistantResponse {
  const verbosity = options.verbosity ?? 'concise';
  const prefix = demoPrefix(options);

  switch (intent.type) {
    case 'APP_CONTROL':
      if (intent.action === 'start_assistant') {
        return { spokenText: `${APP_NAME} is active and listening.` };
      }
      if (intent.action === 'stop_assistant') {
        return { spokenText: `Okay, ${APP_NAME} will stay quiet until you need me.` };
      }
      if (intent.action === 'go_home') {
        return {
          spokenText: 'Going to home.',
          shouldNavigate: 'home',
        };
      }
      if (intent.action === 'open_settings') {
        return {
          spokenText: 'Opening settings.',
          shouldNavigate: 'settings',
        };
      }
      if (intent.action === 'go_back') {
        return {
          spokenText: 'Going back.',
          shouldNavigate: 'back',
        };
      }
      break;

    case 'CAMERA':
      if (intent.action === 'start_camera') {
        return {
          spokenText: 'Starting the camera.',
          shouldStartCamera: true,
        };
      }
      if (intent.action === 'stop_camera') {
        return {
          spokenText: 'Stopping the camera.',
          shouldStopCamera: true,
        };
      }
      break;

    case 'ANNOUNCEMENTS':
      if (intent.action === 'start_announcements') {
        return {
          spokenText: 'Automatic announcements started.',
          shouldEnableAnnouncements: true,
          shouldResumeAnnouncements: true,
        };
      }
      if (intent.action === 'stop_announcements') {
        return {
          spokenText: 'Automatic announcements stopped.',
          shouldDisableAnnouncements: true,
        };
      }
      if (intent.action === 'pause_announcements') {
        return {
          spokenText: 'Automatic announcements stopped.',
          shouldDisableAnnouncements: true,
          shouldPauseAnnouncements: true,
        };
      }
      break;

    case 'HELP':
      return { spokenText: helpText() };

    case 'QUERY_SCENE': {
      const detections = query?.detections ?? [];
      if (detections.length === 0) {
        return {
          spokenText: `${prefix}I do not have any demo objects to describe right now. Start the camera or wait for the next sample update.`,
        };
      }
      const summary = DetectionGroupingService.summarizeWithDirections(detections);
      const detailed =
        verbosity === 'detailed'
          ? ` Closest items include ${detections
              .slice(0, 3)
              .map(d => `${d.className} ${formatStepsText(d.estimatedSteps)}`)
              .join(', ')}.`
          : '';
      return {
        spokenText: `${prefix}I see ${summary}.${detailed}`,
        displayText: summary,
      };
    }

    case 'QUERY_DIRECTION': {
      const detections = query?.detections ?? [];
      const direction = intent.direction ?? 'center';
      const dirLabel =
        direction === 'center' ? 'in front of you' : `on your ${direction}`;
      if (detections.length === 0) {
        return {
          spokenText: `${prefix}I do not detect anything ${dirLabel} in the demo scene.`,
        };
      }
      return {
        spokenText: `${prefix}${dirLabel}, I see ${DetectionGroupingService.summarize(detections)}.`,
      };
    }

    case 'QUERY_DISTANCE': {
      const detections = query?.detections ?? [];
      const steps = intent.maxSteps ?? 5;
      if (detections.length === 0) {
        return {
          spokenText: `${prefix}Nothing within about ${steps} steps in the demo scene.`,
        };
      }
      return {
        spokenText: `${prefix}Within about ${steps} steps, I see ${DetectionGroupingService.summarize(detections)}.`,
      };
    }

    case 'QUERY_YES_NO': {
      const answer = query?.yesNoAnswer ?? query?.matched ?? false;
      const detail = query?.summary ?? '';
      if (intent.action === 'person_nearby') {
        return {
          spokenText: yesNoResponse(
            intent.yesNoQuestion,
            answer,
            answer ? 'There is a person nearby in the demo scene.' : 'No person nearby in the demo scene.',
            options,
          ),
        };
      }
      if (intent.action === 'obstacle_ahead') {
        return {
          spokenText: yesNoResponse(
            intent.yesNoQuestion,
            answer,
            answer ? `There is something ahead: ${detail}` : 'The path ahead looks clear in the demo scene.',
            options,
          ),
        };
      }
      const objectLabel = intent.objectName ?? 'that';
      return {
        spokenText: yesNoResponse(
          intent.yesNoQuestion,
          answer,
          answer
            ? `I do see ${objectLabel}${detail ? `: ${detail}` : ''}.`
            : `I do not see ${objectLabel} in the demo scene.`,
          options,
        ),
      };
    }

    case 'UNKNOWN':
    default:
      return {
        spokenText:
          'Sorry, I did not understand. Say start or stop for announcements, or ask what is ahead of me.',
      };
  }

  return {
    spokenText: 'Sorry, I could not complete that request.',
  };
}

export const ResponseGenerator = { generateResponse };