import { describe, it, expect, beforeEach } from 'vitest';
import { makeSandbox } from '../setup.mjs';

describe('PBKDF2 + AES-GCM 加密', () => {
  let sb;
  beforeEach(() => { sb = makeSandbox(); });

  it('encryptionSetup → 启用标志生效', async () => {
    await sb.encryptionSetup('test-password-123');
    expect(sb.encryptionEnabled()).toBe(true);
  });

  it('明文配置 → 启用加密后 localStorage 中是密文', async () => {
    sb.localStorage.setItem(sb.STORAGE_KEY, JSON.stringify({ openaiKey: 'sk-test' }));
    await sb.encryptionSetup('pwd');
    const raw = sb.localStorage.getItem(sb.STORAGE_KEY);
    expect(raw.startsWith('ENC1:')).toBe(true);
  });

  it('readEncryptedJSON 能解出原 JSON', async () => {
    sb.localStorage.setItem(sb.STORAGE_KEY, JSON.stringify({ openaiKey: 'sk-original' }));
    await sb.encryptionSetup('pwd');
    const back = await sb.readEncryptedJSON(sb.STORAGE_KEY);
    expect(back.openaiKey).toBe('sk-original');
  });

  it('encryptionDisable 恢复明文', async () => {
    sb.localStorage.setItem(sb.STORAGE_KEY, JSON.stringify({ openaiKey: 'sk-X' }));
    await sb.encryptionSetup('pwd');
    expect(sb.localStorage.getItem(sb.STORAGE_KEY).startsWith('ENC1:')).toBe(true);
    await sb.encryptionDisable();
    const restored = sb.localStorage.getItem(sb.STORAGE_KEY);
    expect(restored.startsWith('ENC1:')).toBe(false);
    expect(JSON.parse(restored).openaiKey).toBe('sk-X');
  });

  it('错误密码解锁失败', async () => {
    sb.localStorage.setItem(sb.STORAGE_KEY, JSON.stringify({ openaiKey: 'sk-Y' }));
    await sb.encryptionSetup('correct-pwd');
    // 模拟新进程：清掉 sessionKey
    sb._sessionKey = null;
    await expect(sb.encryptionUnlock('wrong-pwd')).rejects.toThrow();
  });

  it('正确密码解锁成功', async () => {
    sb.localStorage.setItem(sb.STORAGE_KEY, JSON.stringify({ openaiKey: 'sk-Z' }));
    await sb.encryptionSetup('right-pwd');
    sb._sessionKey = null;  // 模拟新会话
    await expect(sb.encryptionUnlock('right-pwd')).resolves.not.toThrow();
  });

  it('writeEncryptedJSON / readEncryptedJSON 往返', async () => {
    await sb.encryptionSetup('pwd');
    const original = { a: 1, b: 'hello', c: [1, 2, 3] };
    await sb.writeEncryptedJSON('test_key', original);
    const back = await sb.readEncryptedJSON('test_key');
    expect(back).toEqual(original);
  });

  it('未启用加密时写入是明文', async () => {
    const data = { plain: 'data' };
    await sb.writeEncryptedJSON('test_key', data);
    const raw = sb.localStorage.getItem('test_key');
    expect(raw).toBe(JSON.stringify(data));
  });
});
