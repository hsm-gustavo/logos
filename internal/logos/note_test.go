package logos

import (
	"reflect"
	"testing"
)

func TestExtractWikiLinksPreservesLinkTargets(t *testing.T) {
	t.Parallel()

	content := "See [[\u00c1lgebra Linear]] and [[Calculus I]]."
	got := extractWikiLinks(content)
	want := []string{"\u00c1lgebra Linear", "Calculus I"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("links mismatch: got %#v want %#v", got, want)
	}
}
