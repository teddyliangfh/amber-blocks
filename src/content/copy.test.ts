import { COPY, MAX_NUMBER_WORD, copyKey, format, numberWord } from './copy';

describe('copy', () => {
  test('AC-17: every key has zh and en, and both carry the same placeholders', () => {
    for (const [key, entry] of Object.entries(COPY)) {
      expect(entry.zh.length).toBeGreaterThan(0);
      expect(entry.en.length).toBeGreaterThan(0);
      for (const name of entry.params) {
        expect(entry.zh).toContain(`{${name}}`);
        expect(entry.en).toContain(`{${name}}`);
      }
      const placeholders = (entry.zh + entry.en).match(/\{[a-z]+\}/g) ?? [];
      for (const p of placeholders) {
        expect(entry.params).toContain(p.slice(1, -1));
      }
      expect(copyKey(key)).toBe(key);
    }
  });

  test('number words cover 1 to 17 in both languages', () => {
    expect(MAX_NUMBER_WORD).toBe(17);
    expect(numberWord(3, 'zh')).toBe('三');
    expect(numberWord(17, 'en')).toBe('seventeen');
    expect(() => numberWord(18, 'zh')).toThrow(/no number word/);
  });

  test('decision 4: numbers render as digits for the screen and words for speech', () => {
    const key = copyKey('feedback.matched.addition');
    expect(format(key, 'zh', { a: 3, b: 4, n: 7 })).toBe('3 加 4，一共 7');
    expect(format(key, 'zh', { a: 3, b: 4, n: 7 }, { numbers: 'word' })).toBe('三 加 四，一共 七');
    expect(format(key, 'en', { a: 3, b: 4, n: 7 }, { numbers: 'word' })).toBe('three plus four makes seven');
    expect(format(copyKey('feedback.matched.quantity'), 'en', { n: 4 })).toBe('4. 4 blocks');
    expect(format(copyKey('hint.not-merged'), 'zh', { a: 3, b: 4 }, { numbers: 'word' })).toBe('把 三 和 四 推到一起');
    expect(format(copyKey('count.progress'), 'en', { k: 'two' })).toBe('two so far');
  });

  test('spoken Chinese says 两 for two of something, 二 for the number itself', () => {
    expect(format(copyKey('count.total'), 'zh', { n: 2 }, { numbers: 'word' })).toBe('一共 两 块');
    expect(format(copyKey('feedback.matched.quantity'), 'zh', { n: 2 }, { numbers: 'word' })).toBe('二，就是 两 块');
    expect(format(copyKey('count.total'), 'zh', { n: 3 }, { numbers: 'word' })).toBe('一共 三 块');
    expect(format(copyKey('hint.not-merged'), 'zh', { a: 2, b: 2 }, { numbers: 'word' })).toBe('把 二 和 二 推到一起');
    // The screen keeps digits; English is unchanged.
    expect(format(copyKey('count.total'), 'zh', { n: 2 })).toBe('一共 2 块');
    expect(format(copyKey('count.total'), 'en', { n: 2 }, { numbers: 'word' })).toBe('two in all');
  });

  test('missing params and unknown keys are content bugs', () => {
    expect(() => format(copyKey('prompt.quantity'), 'zh')).toThrow(/needs param n/);
    expect(() => copyKey('prompt.nope')).toThrow(/unknown key/);
    expect(() => format('prompt.nope' as never, 'zh')).toThrow(/unknown key/);
  });
});
