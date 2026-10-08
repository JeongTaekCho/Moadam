package com.moadam.ai.retrieval;

import com.moadam.note.repository.NoteRepository;
import java.util.*;
import org.springframework.stereotype.Component;

/** Selects the allowed document scope; Python RAG performs actual vector retrieval. */
@Component
public class NoteRetriever {
  private final NoteRepository notes;

  public NoteRetriever(NoteRepository notes) {
    this.notes = notes;
  }

  public List<UUID> readyDocumentIds(UUID group) {
    return notes.readyDocumentIds(group);
  }
}
