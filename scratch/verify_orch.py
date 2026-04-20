import asyncio
from unittest.mock import MagicMock, AsyncMock, patch
from uuid import uuid4
from app.services.session_orchestrator import SessionOrchestrator
from app.schemas.domain import TranscriptSegment

async def test_session_orchestrator_refinement():
    print("Testing SessionOrchestrator transcript refinement logic...")
    
    # Mock dependencies
    stt = MagicMock()
    stt.transcribe = AsyncMock(return_value=[
        TranscriptSegment(start=1.0, end=2.0, text="Hello world", speaker="customer")
    ])
    
    orch = SessionOrchestrator(
        stt=stt, age_estimator=MagicMock(), liveness=MagicMock(),
        llm=MagicMock(), bureau=MagicMock(), risk=MagicMock(),
        policy=MagicMock(), offers=MagicMock(), geo=MagicMock(),
        audit=AsyncMock()
    )
    
    sid = uuid4()
    orch._audio_buffers[sid] = bytearray(b"dummy_audio")
    
    # Mock database session and flow
    with patch('app.services.session_orchestrator.session_scope', return_value=MagicMock(__aenter__=AsyncMock(), __aexit__=AsyncMock())), \
         patch.object(orch, '_load_transcript', return_value=[]), \
         patch.object(orch, '_persist_transcript', return_value=AsyncMock()) as mock_persist, \
         patch('app.services.session_orchestrator.delete') as mock_delete:
         
        await orch.ingest_audio(sid, b"more_audio")
        
        # Verify delete was called for segments starting after window_start
        # Window start should be around 1.0 - 0.5 = 0.5
        mock_delete.assert_called_once()
        print("✓ Delete statement called for refinement")
        
        # Verify persist was called with the new segments
        mock_persist.assert_called_once()
        print("✓ Persist called with refined segments")

if __name__ == "__main__":
    asyncio.run(test_session_orchestrator_refinement())
