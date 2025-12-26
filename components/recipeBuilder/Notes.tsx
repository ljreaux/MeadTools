"use client";

import React from "react";
import { Textarea } from "../ui/textarea";
import { Button } from "../ui/button";
import { useTranslation } from "react-i18next";
import DragList from "../ui/DragList";
import { Trash } from "lucide-react";

import type { NoteLine as NoteLine } from "@/types/recipeData";
import { useRecipe } from "../providers/RecipeProvider";

type TextAreaProps = {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
};

export default function Notes() {
  const { t } = useTranslation();

  const {
    data: { notes },
    notes: notesApi
  } = useRecipe();

  return (
    <div>
      {/* Primary */}
      <div className="joyride-notesCard py-6">
        <h2>{t("notes.subtitleOne")}</h2>

        {notes.primary.length > 0 ? (
          <DragList
            items={notes.primary}
            setItems={notesApi.primary.reorder}
            getId={(n) => n.lineId}
            renderItem={(note) => (
              <NoteLine
                key={note.lineId}
                note={note}
                remove={() => notesApi.primary.remove(note.lineId)}
                noteProps={{
                  value: note.content[0],
                  onChange: (e) =>
                    notesApi.primary.setText(note.lineId, e.target.value)
                }}
                detailProps={{
                  value: note.content[1],
                  onChange: (e) =>
                    notesApi.primary.setDetails(note.lineId, e.target.value)
                }}
              />
            )}
          />
        ) : (
          <p className="py-6">{t("emptyNotes")}</p>
        )}

        <Button
          onClick={notesApi.primary.add}
          disabled={notes.primary.length >= 10}
          variant="secondary"
        >
          {t("newNote")}
        </Button>
      </div>

      {/* Secondary */}
      <div className="py-6">
        <h2>{t("notes.subtitleTwo")}</h2>

        {notes.secondary.length > 0 ? (
          <DragList
            items={notes.secondary}
            setItems={notesApi.secondary.reorder}
            getId={(n) => n.lineId}
            renderItem={(note) => (
              <NoteLine
                key={note.lineId}
                note={note}
                remove={() => notesApi.secondary.remove(note.lineId)}
                noteProps={{
                  value: note.content[0],
                  onChange: (e) =>
                    notesApi.secondary.setText(note.lineId, e.target.value)
                }}
                detailProps={{
                  value: note.content[1],
                  onChange: (e) =>
                    notesApi.secondary.setDetails(note.lineId, e.target.value)
                }}
              />
            )}
          />
        ) : (
          <p className="py-6">{t("emptyNotes")}</p>
        )}

        <Button
          onClick={notesApi.secondary.add}
          disabled={notes.secondary.length >= 10}
          variant="secondary"
        >
          {t("newNote")}
        </Button>
      </div>
    </div>
  );
}

const NoteLine = ({
  noteProps,
  detailProps,
  remove
}: {
  note: NoteLine;
  noteProps: TextAreaProps;
  detailProps: TextAreaProps;
  remove: () => void;
}) => {
  const { t } = useTranslation();

  return (
    <div className="joyride-noteLine relative py-4">
      <Button
        onClick={remove}
        variant="destructive"
        size="sm"
        className="absolute top-0 right-0"
      >
        <Trash className="h-4 w-4" />
      </Button>

      <div className="grid gap-4 pr-16 sm:grid-cols-2">
        <label className="grid gap-1">
          <span className="text-sm font-medium">{t("notes.note")}</span>
          <Textarea {...noteProps} placeholder={t("notes.placeholder")} />
        </label>

        <label className="grid gap-1">
          <span className="text-sm font-medium">{t("notes.details")}</span>
          <Textarea {...detailProps} placeholder={t("notes.placeholder")} />
        </label>
      </div>
    </div>
  );
};
