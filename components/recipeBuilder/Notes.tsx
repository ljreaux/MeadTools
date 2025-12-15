import { Textarea } from "../ui/textarea";
import { Button } from "../ui/button";
import { useTranslation } from "react-i18next";
import { Recipe } from "@/types/recipeDataTypes";
import DragList from "../ui/DragList";
import { Trash } from "lucide-react";

type TextAreaProps = {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
};

function Notes({ useRecipe }: { useRecipe: () => Recipe }) {
  const { t } = useTranslation();
  const {
    notes,
    editPrimaryNote,
    editSecondaryNote,
    removePrimaryNote,
    removeSecondaryNote,
    addPrimaryNote,
    addSecondaryNote,
    setPrimaryNotes,
    setSecondaryNotes
  } = useRecipe();
  return (
    <div>
      <div className="joyride-notesCard py-6">
        <h2>{t("notes.subtitleOne")}</h2>

        {notes.primary.length > 0 ? (
          <>
            <DragList
              items={notes.primary}
              setItems={setPrimaryNotes}
              renderItem={(note) => {
                return (
                  <Note
                    key={note.id}
                    remove={() => removePrimaryNote(note.id)}
                    noteProps={{
                      value: note.content[0],
                      onChange: (e) =>
                        editPrimaryNote.text(note.id, e.target.value)
                    }}
                    detailProps={{
                      value: note.content[1],
                      onChange: (e) =>
                        editPrimaryNote.details(note.id, e.target.value)
                    }}
                  />
                );
              }}
            />
          </>
        ) : (
          <p className="py-6">Press the button below to add a Note.</p>
        )}
        <Button
          onClick={addPrimaryNote}
          disabled={notes.primary.length >= 10}
          variant="secondary"
        >
          New Note
        </Button>
      </div>
      <div className="py-6">
        <h2>{t("notes.subtitleTwo")}</h2>
        {notes.secondary.length > 0 ? (
          <>
            <DragList
              items={notes.secondary}
              setItems={setSecondaryNotes}
              renderItem={(note) => {
                return (
                  <Note
                    key={note.id}
                    remove={() => removeSecondaryNote(note.id)}
                    noteProps={{
                      value: note.content[0],
                      onChange: (e) =>
                        editSecondaryNote.text(note.id, e.target.value)
                    }}
                    detailProps={{
                      value: note.content[1],
                      onChange: (e) =>
                        editSecondaryNote.details(note.id, e.target.value)
                    }}
                  />
                );
              }}
            />
          </>
        ) : (
          <p className="py-6">Press the button below to add a Note.</p>
        )}
        <Button
          onClick={addSecondaryNote}
          disabled={notes.secondary.length >= 10}
          variant="secondary"
        >
          New Note
        </Button>
      </div>
    </div>
  );
}

export default Notes;

const Note = ({
  noteProps,
  detailProps,
  remove
}: {
  noteProps: TextAreaProps;
  detailProps: TextAreaProps;
  remove: () => void;
}) => {
  const { t } = useTranslation();

  return (
    <div className="joyride-noteLine relative py-4">
      {/* Remove button in top-right, consistent with Ingredients/Additives */}
      <Button
        onClick={remove}
        variant="destructive"
        size="sm"
        className="absolute top-0 right-0"
      >
        <Trash className="h-4 w-4" />
      </Button>

      {/* Two textareas side-by-side on desktop */}
      <div className="grid gap-4 pr-16 sm:grid-cols-2">
        <label className="grid gap-1">
          <span className="text-sm font-medium">Note</span>
          <Textarea {...noteProps} placeholder={t("notes.placeholder")} />
        </label>

        <label className="grid gap-1">
          <span className="text-sm font-medium">Details</span>
          <Textarea {...detailProps} placeholder={t("notes.placeholder")} />
        </label>
      </div>
    </div>
  );
};
