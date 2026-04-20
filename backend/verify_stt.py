from unittest.mock import MagicMock, patch
import numpy as np
from app.services.stt.whisper_stt import FasterWhisperSTT, _whisper_segments_to_transcript_rows
from app.schemas.domain import TranscriptSegment

def test_offset_logic():
    print("Testing _whisper_segments_to_transcript_rows with offset...")
    mock_seg = MagicMock()
    mock_seg.text = "Hello world"
    mock_seg.start = 1.0
    mock_seg.end = 2.0
    mock_seg.avg_logprob = -0.5
    
    segments = [mock_seg]
    offset = 10.0
    
    rows = _whisper_segments_to_transcript_rows(segments, offset_s=offset)
    
    assert len(rows) == 1
    assert rows[0].text == "Hello world"
    assert rows[0].start == 11.0
    assert rows[0].end == 12.0
    print("✓ Offset logic passed")

async def test_transcribe_windowing():
    print("Testing FasterWhisperSTT.transcribe windowing...")
    stt = FasterWhisperSTT()
    stt._model = MagicMock() # Mock model
    
    # Mock decode_audio to return 40 seconds of audio at 16kHz
    sr = 16000
    long_audio = np.zeros(40 * sr, dtype=np.float32)
    
    with patch.object(FasterWhisperSTT, '_decode_audio', return_value=long_audio), \
         patch('app.services.stt.whisper_stt._transcribe_sync_collect', return_value=[]) as mock_collect:
        
        await stt.transcribe(b"a" * 100, sample_rate=sr)
        
        # Check that mock_collect was called with 30 seconds of audio
        called_audio = mock_collect.call_args[0][1]
        assert len(called_audio) == 30 * sr
        print("✓ Windowing (30s) logic passed")

if __name__ == "__main__":
    import asyncio
    test_offset_logic()
    asyncio.run(test_transcribe_windowing())
