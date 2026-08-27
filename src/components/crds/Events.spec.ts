import { GENERATOR_KIND_DEFS } from './Generator';
import { getInvolvedObjectKind } from './Events';

describe('getInvolvedObjectKind', () => {
  it('maps existing dashboard resource types', () => {
    expect(getInvolvedObjectKind('certificates')).toBe('Certificate');
    expect(getInvolvedObjectKind('externalsecrets')).toBe('ExternalSecret');
    expect(getInvolvedObjectKind('bundles')).toBe('Bundle');
  });

  it('maps every generator plural to its Kind', () => {
    for (const def of GENERATOR_KIND_DEFS) {
      expect(getInvolvedObjectKind(def.plural)).toBe(def.kind);
    }
  });

  it('returns the raw resource type when unmapped', () => {
    expect(getInvolvedObjectKind('not-a-resource')).toBe('not-a-resource');
  });
});
