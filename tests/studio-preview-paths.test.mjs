import { test } from 'node:test';
import assert from 'node:assert/strict';
import { studioPreviewPages, studioPreviewTarget } from '../src/studio-preview-paths.ts';

const files=['frontend/index.html','frontend/about.html','frontend/lore/index.html','frontend/lore/chapter.htm','frontend/with spaces.html','backend/private.html','frontend/app.js'].map(path=>({path,content:'',encoding:'utf8',locked:false}));
test('resolves local multipage navigation, directory indexes, fragments and nested paths',()=>{
  assert.deepEqual(studioPreviewTarget(files,'../about.html?source=lore#team','frontend/lore/index.html'),{path:'frontend/about.html',search:'?source=lore',hash:'#team',location:'frontend/about.html?source=lore#team'});
  assert.equal(studioPreviewTarget(files,'/lore/')?.path,'frontend/lore/index.html');
  assert.equal(studioPreviewTarget(files,'/about')?.path,'frontend/about.html');
  assert.equal(studioPreviewTarget(files,'chapter.htm','frontend/lore/index.html')?.path,'frontend/lore/chapter.htm');
  assert.equal(studioPreviewTarget(files,'#chapter','frontend/lore/index.html')?.location,'frontend/lore/index.html#chapter');
  assert.equal(studioPreviewTarget(files,'../with%20spaces.html','frontend/lore/index.html')?.path,'frontend/with spaces.html');
  assert.equal(studioPreviewPages(files)[0],'frontend/index.html');
});
test('never resolves external URLs, scripts, backend files or absent pages as preview documents',()=>{
  for(const href of ['https://example.com','//example.com','javascript:alert(1)','data:text/html,test','/backend/private.html','../../backend/private.html','/app.js','missing.html','/%ZZ','/a\\b','/a\nb','/%2e%2e%2fbackend/private.html'])
    assert.equal(studioPreviewTarget(files,href),null,href);
  assert.equal(studioPreviewPages(files).some(path=>path.startsWith('backend/')),false);
});
