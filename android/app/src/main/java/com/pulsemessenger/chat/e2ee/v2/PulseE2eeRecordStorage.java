package com.pulsemessenger.chat.e2ee.v2;

import java.security.GeneralSecurityException;

public interface PulseE2eeRecordStorage {
    void put(String userId, String recordType, String recordId, byte[] plaintext)
        throws GeneralSecurityException;

    byte[] get(String userId, String recordType, String recordId)
        throws GeneralSecurityException;

    boolean remove(String userId, String recordType, String recordId);
}
