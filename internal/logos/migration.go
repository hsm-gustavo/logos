package logos

import "context"

func MigrateFileStoreToStore(ctx context.Context, sourceDir string, destination Store) error {
	source := NewFileStore(sourceDir)
	notes, err := source.List(ctx)
	if err != nil {
		return err
	}

	for _, note := range notes {
		if err := destination.Save(ctx, note); err != nil {
			return err
		}
	}

	return nil
}
