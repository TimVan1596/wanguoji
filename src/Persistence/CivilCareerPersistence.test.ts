import {expect,it} from 'vitest';
import {createEmptyWorldSaveV22,CURRENT_SAVE_SCHEMA_VERSION} from './WorldSaveSchema';
import {validateWorldSave} from './WorldSaveValidator';
it('requires V59 and rejects V58 without mutating the old save',()=>{
 const save=createEmptyWorldSaveV22();expect(CURRENT_SAVE_SCHEMA_VERSION).toBe(60);expect(validateWorldSave(save).valid).toBe(true);
 const old=JSON.parse(JSON.stringify(save));old.saveSchemaVersion=58;const before=JSON.stringify(old);expect(validateWorldSave(old).valid).toBe(false);expect(JSON.stringify(old)).toBe(before);
});
