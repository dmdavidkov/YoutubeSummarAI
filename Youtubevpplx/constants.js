// Check if DEFAULT_PROVIDER_SETTINGS is already defined
if (typeof DEFAULT_PROVIDER_SETTINGS === 'undefined') {
    const DEFAULT_PROVIDER_SETTINGS = {
        you: {
            url: 'https://you.com/?chatMode=custom',
            inputSelector: '#search-input-textarea',
            buttonSelector: 'button[type="submit"]',
            confirmButtonSelector: '#modalBackdrop > div > div > div > div.sc-d5bd68a7-0.gdOqdn > div > div > button:nth-child(2)', 
            resultSelector: '.AnswerParser_AnswerParserSharedStyles__0GZUj'
        },
        perplexity: {
            url: 'https://www.perplexity.ai/',
            inputSelector: '#__next > main > div > div > div.isolate.flex.h-auto.w-full.grow.flex-col.md\:gap-xs.lg\:pb-sm.lg\:pr-sm.lg\:pt-sm > div.flex-1.overflow-clip.bg-clip-border.shadow-sm.lg\:rounded-lg.md\:dark\:border.border-borderMain\/50.ring-borderMain\/50.divide-borderMain\/50.dark\:divide-borderMainDark\/50.dark\:ring-borderMainDark\/50.dark\:border-borderMainDark\/50.bg-background.dark\:bg-backgroundDark > div > div.mx-auto.h-full.w-full.max-w-screen-md.px-md.md\:px-lg > div > div > div.mt-lg.w-full.grow.flex-col.items-center.justify-center.md\:mt-0.md\:flex.border-borderMain\/50.ring-borderMain\/50.divide-borderMain\/50.dark\:divide-borderMainDark\/50.dark\:ring-borderMainDark\/50.dark\:border-borderMainDark\/50.bg-transparent > div:nth-child(2) > div > div > span > div > div > div.col-start-1.col-end-4.pb-sm.overflow-hidden.relative.flex.h-full.w-full > textarea',
            buttonSelector: '#__next > main > div > div > div.isolate.flex.h-auto.w-full.grow.flex-col.md\:gap-xs.lg\:pb-sm.lg\:pr-sm.lg\:pt-sm > div.flex-1.overflow-clip.bg-clip-border.shadow-sm.lg\:rounded-lg.md\:dark\:border.border-borderMain\/50.ring-borderMain\/50.divide-borderMain\/50.dark\:divide-borderMainDark\/50.dark\:ring-borderMainDark\/50.dark\:border-borderMainDark\/50.bg-background.dark\:bg-backgroundDark > div > div.mx-auto.h-full.w-full.max-w-screen-md.px-md.md\:px-lg > div > div > div.mt-lg.w-full.grow.flex-col.items-center.justify-center.md\:mt-0.md\:flex.border-borderMain\/50.ring-borderMain\/50.divide-borderMain\/50.dark\:divide-borderMainDark\/50.dark\:ring-borderMainDark\/50.dark\:border-borderMainDark\/50.bg-transparent > div:nth-child(2) > div > div > span > div > div > div.bg-background.dark\:bg-offsetDark.flex.items-center.space-x-2.justify-self-end.rounded-full.col-start-3.row-start-2.-mr-2 > button',
            resultSelector: '.prose'
        },
        phind: {
            url: 'https://www.phind.com/',
            inputSelector: '#__next > div > div > div.col-lg-10.sidebar > main > div > div > div > div.row.justify-content-center.mx-auto > div.col-8 > form > div > div:nth-child(1) > textarea',
            buttonSelector: '#__next > div > div > div.col-lg-10.sidebar > main > div > div > div > div.row.justify-content-center.mx-auto > div.col-8 > form > div > div.row > div.col-4.d-flex.justify-content-end > button:nth-child(7)',
            resultSelector: '#__next > div > div > div.col-lg-10.sidebar > main > div > div:nth-child(2) > div.row > div.col-12.mt-5 > div:nth-child(1) > div'
        },
        gemini: {
            url: 'https://aistudio.google.com/app/prompts/new_chat',
            inputSelector: 'body > app-root > div > div > div > div > span > ms-prompt-switcher > ms-chunk-editor > section > footer > div.input-wrapper > div.text-wrapper > ms-chunk-input > section > ms-text-chunk > textarea',
            buttonSelector: 'body > app-root > div > div > div > div > span > ms-prompt-switcher > ms-chunk-editor > section > footer > div.input-wrapper > div:nth-child(3) > run-button > button',
            resultSelector: 'ms-chat-turn:nth-child(2) > div > div.prompt-container'
        },
        chatgpt: {
            url: 'https://chatgpt.com',
            inputSelector: '#prompt-textarea',
            buttonSelector: 'body > div.relative.flex.h-full.w-full.overflow-hidden.transition-colors.z-0 > div.relative.flex.h-full.max-w-full.flex-1.flex-col.overflow-hidden > main > div.composer-parent.flex.h-full.flex-col.focus-visible\:outline-0 > div.md\:pt-0.dark\:border-white\/20.md\:border-transparent.md\:dark\:border-transparent.w-full > div > div.text-base.px-3.md\:px-4.m-auto.w-full.md\:px-5.lg\:px-4.xl\:px-5 > div > form > div > div.group.relative.flex.w-full.items-center > div.flex.w-full.flex-col.gap-1\.5.rounded-\[26px\].p-1\.5.transition-colors.bg-\[\#f4f4f4\].dark\:bg-token-main-surface-secondary > div > button',
            confirmButtonSelector: '',
            resultSelector: 'body > div.relative.flex.h-full.w-full.overflow-hidden.transition-colors.z-0 > div.relative.flex.h-full.max-w-full.flex-1.flex-col.overflow-hidden > main > div.composer-parent.flex.h-full.flex-col.focus-visible\:outline-0 > div.flex-1.overflow-hidden > div > div > div > div > article:nth-child(3) > div > div > div.group\/conversation-turn.relative.flex.w-full.min-w-0.flex-col.agent-turn > div > div.flex.max-w-full.flex-col.flex-grow > div'
        },
        custom: {
            url: '',
            inputSelector: '',
            buttonSelector: '',
            confirmButtonSelector: '',
            resultSelector: ''
        }
    };

    const DEFAULT_AI_PROVIDER = 'you';
    const DEFAULT_TRANSCRIPTION_METHOD = 'youtube';
    const DEFAULT_PROCESS_LOCALLY = false;

    // Export the constants
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            DEFAULT_PROVIDER_SETTINGS,
            DEFAULT_AI_PROVIDER,
            DEFAULT_TRANSCRIPTION_METHOD,
            DEFAULT_PROCESS_LOCALLY
        };
    } else if (typeof window !== 'undefined') {
        window.DEFAULT_PROVIDER_SETTINGS = DEFAULT_PROVIDER_SETTINGS;
        window.DEFAULT_AI_PROVIDER = DEFAULT_AI_PROVIDER;
        window.DEFAULT_TRANSCRIPTION_METHOD = DEFAULT_TRANSCRIPTION_METHOD;
        window.DEFAULT_PROCESS_LOCALLY = DEFAULT_PROCESS_LOCALLY;
    }
}