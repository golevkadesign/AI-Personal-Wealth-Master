type LongbridgeNativeStatus = {
    ok: boolean;
    platform: NodeJS.Platform;
    arch: string;
    libc?: 'gnu' | 'musl';
    glibcVersion?: string;
    expectedPackage?: string;
    error?: string;
};

let longbridgeSdkCache: any | null = null;

function detectLibc(): 'gnu' | 'musl' | undefined {
    if (process.platform !== 'linux') return undefined;
    const report = typeof process.report?.getReport === 'function'
        ? process.report.getReport() as { header?: { glibcVersionRuntime?: string } }
        : undefined;
    return report?.header?.glibcVersionRuntime ? 'gnu' : 'musl';
}

function detectGlibcVersion(): string | undefined {
    if (process.platform !== 'linux') return undefined;
    const report = typeof process.report?.getReport === 'function'
        ? process.report.getReport() as { header?: { glibcVersionRuntime?: string } }
        : undefined;
    return report?.header?.glibcVersionRuntime;
}

function getExpectedLongbridgeNativePackage(): string | undefined {
    const { platform, arch } = process;
    if (platform === 'darwin' && arch === 'arm64') return 'longbridge-darwin-arm64';
    if (platform === 'darwin' && arch === 'x64') return 'longbridge-darwin-x64';
    if (platform === 'linux' && arch === 'arm64') return 'longbridge-linux-arm64-gnu';
    if (platform === 'linux' && arch === 'x64') {
        return detectLibc() === 'musl' ? 'longbridge-linux-x64-musl' : 'longbridge-linux-x64-gnu';
    }
    if (platform === 'win32' && arch === 'x64') return 'longbridge-win32-x64-msvc';
    return undefined;
}

function collectErrorChain(error: any): string[] {
    const chain: string[] = [];
    let current = error;
    const seen = new Set();
    while (current && !seen.has(current)) {
        seen.add(current);
        chain.push(current?.message || String(current));
        current = current?.cause;
    }
    return chain;
}

function withLongbridgeNativeContext(error: any): Error {
    const expectedPackage = getExpectedLongbridgeNativePackage();
    const causeChain = collectErrorChain(error).slice(1);
    const message = [
        error?.message || String(error),
        expectedPackage ? `(expected native package: ${expectedPackage})` : '(unsupported native platform)',
        causeChain.length ? `(loader cause: ${causeChain.join(' <- ')})` : '',
        'Run npm ci --include=optional in the Linux image and ensure host node_modules is excluded from the Docker context.',
    ].filter(Boolean).join(' ');
    const next = new Error(message);
    next.stack = error?.stack;
    return next;
}

export async function loadLongbridgeSdk() {
    if (longbridgeSdkCache) return longbridgeSdkCache;
    try {
        const lbModule: any = await import('longbridge');
        longbridgeSdkCache = { ...(lbModule?.default || {}), ...lbModule };
        return longbridgeSdkCache;
    } catch (error) {
        throw withLongbridgeNativeContext(error);
    }
}

export async function getLongbridgeNativeStatus(): Promise<LongbridgeNativeStatus> {
    try {
        await loadLongbridgeSdk();
        return {
            ok: true,
            platform: process.platform,
            arch: process.arch,
            libc: detectLibc(),
            glibcVersion: detectGlibcVersion(),
            expectedPackage: getExpectedLongbridgeNativePackage(),
        };
    } catch (error: any) {
        return {
            ok: false,
            platform: process.platform,
            arch: process.arch,
            libc: detectLibc(),
            glibcVersion: detectGlibcVersion(),
            expectedPackage: getExpectedLongbridgeNativePackage(),
            error: error?.message || String(error),
        };
    }
}
