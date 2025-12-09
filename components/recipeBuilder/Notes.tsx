import { Textarea } from "../ui/textarea";
import { Button } from "../ui/button";
import { useTranslation } from "react-i18next";
import { Recipe } from "@/types/recipeDataTypes";
import DragList from "../ui/DragList";

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
    <div className="grid sm:grid-cols-12 grid-cols-6 gap-4 py-4 relative items-center w-full">
      <label className="sm:col-span-5 col-span-full">
        Note
        <Textarea {...noteProps} placeholder={t("notes.placeholder")} />
      </label>
      <label className="sm:col-span-4 col-span-full">
        Details
        <Textarea {...detailProps} placeholder={t("notes.placeholder")} />
      </label>
      <Button
        onClick={remove}
        variant="destructive"
        className="sm:col-span-2 col-span-full"
      >
        Remove
      </Button>
    </div>
  );
};
