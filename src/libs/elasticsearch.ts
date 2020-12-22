import axios, {AxiosResponse} from "axios";
import {ElasticSearchHost} from "./config";

const Host = ElasticSearchHost;

const querySize = 20;

interface IUserVideoResult {
    hits: {
        total: {
            value: number
        },
        hits: Array<{
            _id: string
        }>
    };

    //   "hits": {
    //     "total": {
    //         "value": 1,
    //         "relation": "eq"
    //     },
    //     "max_score": 0.08902092,
    //     "hits": [
    //         {
    //             "_index": "videoplatform.videos",
    //             "_type": "_doc",
    //             "_id": "6005350824af64ea87ca9f8d",
    //             "_score": 0.08902092,
    //             "_source": {
    //                 "__v": 0,
    //                 "available": true,
    //                 "clips": [
    //                     {
    //                         "_id": "600535768325d4237173bf40",
    //                         "definition": "FullHD",
    //                         "object": "/Users/jeremyli/Documents/Coding/video-platform-services/go-video-converter/converted/27a35cee9b79d8b1d9e20b60f2fa111e_1920x1080_.mp4"
    //                     },
    //                     {
    //                         "_id": "600535768325d4237173bf41",
    //                         "definition": "HD",
    //                         "object": "/Users/jeremyli/Documents/Coding/video-platform-services/go-video-converter/converted/27a35cee9b79d8b1d9e20b60f2fa111e_1280x720_.mp4"
    //                     },
    //                     {
    //                         "_id": "600535768325d4237173bf42",
    //                         "definition": "SD",
    //                         "object": "/Users/jeremyli/Documents/Coding/video-platform-services/go-video-converter/converted/27a35cee9b79d8b1d9e20b60f2fa111e_854x480_.mp4"
    //                     }
    //                 ],
    //                 "created_timestamp": "2021-01-18T07:13:12.899Z",
    //                 "duration": 227,
    //                 "isPublic": false,
    //                 "owner": "5ffea2fa2e4e5c09477131fa",
    //                 "tags": [
    //                     "EDUCATION"
    //                 ],
    //                 "title": "Test",
    //                 "top_comments": [],
    //                 "updated_timestamp": "2021-01-18T07:15:02.911Z"
    //             }
    //         }
    //     ]
    // }
}

export const queryUserVideo = (video: string, page: number) => {
    const from = (page - 1) * querySize;

    return axios.post<any, AxiosResponse<IUserVideoResult>>(`${Host}/videoplatform.videos/_search`, {
        "from": from,
        "size": querySize,
        "query": {
            "bool": {
                "must": [
                    {
                        "match": {
                            "title": {
                                "query": video,
                                "fuzziness": 1
                            }
                        }
                    },
                    {
                        "match": {
                            "isPublic": true
                        }
                    },
                    {
                        "match": {
                            "available": true
                        }
                    }
                ]
            }
        }
    });
};