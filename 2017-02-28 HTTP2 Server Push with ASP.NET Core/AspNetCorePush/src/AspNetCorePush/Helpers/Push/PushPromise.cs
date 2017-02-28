namespace AspNetCorePush.Helpers.Push
{
    public class PushPromise
    {
        public PushPromise(string url, string assetType)
        {
            Url = url;
            AssetType = assetType;
        }

        public string AssetType { get; }
        public string Url { get; }

        public override string ToString()
        {
            return $"<{Url}>; rel=preload; as={AssetType}";
        }
    }
}