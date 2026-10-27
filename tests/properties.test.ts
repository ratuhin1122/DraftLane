import assert from 'node:assert/strict';
import { test } from 'node:test';
import fc from 'fast-check';
import * as Y from 'yjs';
import { updateCanvasCrdt, canvasFromCrdt } from '../lib/canvas-crdt';
import { drawingShift, reservedDrawingEdge, DRAWING_GAP } from '../lib/agent-placement';

test('randomized offline edits converge despite duplicate and reordered delivery', () => {
  fc.assert(fc.property(fc.array(fc.record({ client: fc.integer({min:0,max:2}), key:fc.integer({min:0,max:15}), value:fc.integer(), remove:fc.boolean() }), {minLength:1,maxLength:100}), operations => {
    const base = new Y.Doc();
    updateCanvasCrdt(base,{document:{schema:{version:1},store:{}}});
    const clients = [new Y.Doc(),new Y.Doc(),new Y.Doc()];
    clients.forEach(doc=>Y.applyUpdate(doc,Y.encodeStateAsUpdate(base)));
    try {
      for (const op of operations) {
        const records=clients[op.client].getMap<string>('records');
        if(op.remove) records.delete('shape:'+op.key);
        else records.set('shape:'+op.key,JSON.stringify({id:'shape:'+op.key,x:op.value}));
      }
      const updates=clients.map(doc=>Y.encodeStateAsUpdate(doc));
      for(const i of [0,1,2]) for(const j of [i,(i+1)%3,(i+2)%3,i]) Y.applyUpdate(clients[i],updates[j]);
      assert.deepEqual(canvasFromCrdt(clients[0]),canvasFromCrdt(clients[1]));
      assert.deepEqual(canvasFromCrdt(clients[1]),canvasFromCrdt(clients[2]));
    } finally {base.destroy();clients.forEach(doc=>doc.destroy());}
  }),{seed:20261028,numRuns:250});
});

const bounds=fc.record({x:fc.integer({min:-100000,max:100000}),y:fc.integer(),w:fc.integer({min:1,max:10000}),h:fc.integer({min:1,max:10000})});
test('randomized AI placements always leave the promised clearance',()=>{
  fc.assert(fc.property(fc.array(bounds,{minLength:1,maxLength:100}),fc.array(bounds,{minLength:1,maxLength:100}),(existing,incoming)=>{
    const shift=drawingShift(reservedDrawingEdge(existing),incoming);
    assert.ok(Math.min(...incoming.map(b=>b.x+shift))>=Math.max(...existing.map(b=>b.x+b.w))+DRAWING_GAP);
  }),{seed:20261028,numRuns:500});
});
